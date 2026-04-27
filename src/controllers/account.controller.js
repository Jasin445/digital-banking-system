
const Account = require('../models/account.model');
const Customer = require('../models/customer.model');
const nibssService = require('../services/nibss.service');

/**
 * Attempts to recover an account that exists on NIBSS but not in local DB.
 *
 * NIBSS returns 400 "bvn already linked to an account" with NO account details.
 * The only way to find the account is to fetch all accounts under our bank
 * and match by accountName against the customer's name.
 */
const recoverNibssAccount = async (customer) => {
  try {
    const nibssResponse = await nibssService.getAllAccounts();
    const accounts = nibssResponse.data?.accounts || nibssResponse.accounts || [];

    // Match by full name — NIBSS stores accountName as "FirstName LastName"
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const match = accounts.find(
      (acc) => acc.accountName?.toLowerCase() === fullName
    );

    return match || null;
  } catch (err) {
    console.error('[Recovery] Failed to fetch NIBSS accounts:', err.message);
    return null;
  }
};

/**
 * POST /api/accounts/create
 *
 * Handles three scenarios:
 *  A. Happy path — no account anywhere → create on NIBSS → save locally
 *  B. Account exists locally → return it (idempotent)
 *  C. Account exists on NIBSS but not locally (previous crash) → recover and save
 */
exports.createAccount = async (req, res, next) => {
  try {
    const customer = req.customer;

    if (!customer.kycVerified) {
      return res.status(403).json({ message: 'KYC verification is required before account creation.' });
    }

    // ── Scenario B: Account already exists locally ────────────────────────────
    const existingAccount = await Account.findOne({ customerId: customer._id });
    if (existingAccount) {
      return res.status(409).json({
        message: 'You already have a bank account.',
        account: {
          accountNumber: existingAccount.accountNumber,
          accountName: existingAccount.accountName,
          bankCode: existingAccount.bankCode,
          bankName: existingAccount.bankName,
          balance: existingAccount.balance,
        },
      });
    }

    // ── Scenario A & C: Try to create on NIBSS ────────────────────────────────
    let nibssAccount;
    try {
      const nibssResponse = await nibssService.createAccount(
        customer.kycType,
        customer.kycID,
        customer.dob
      );
      nibssAccount = nibssResponse.account || nibssResponse;
    } catch (err) {
      const nibssMessage = err.response?.data?.message || '';

      // NIBSS returns 400 "bvn already linked to an account" or "nin already linked to an account"
      // when an account already exists for this identity — no account details are returned.
      // Recover by fetching all accounts and matching by name.
      if (nibssMessage.includes('already linked to an account')) {
        nibssAccount = await recoverNibssAccount(customer);

        if (!nibssAccount?.accountNumber) {
          return res.status(409).json({
            message: 'An account already exists for this identity on NIBSS but could not be recovered automatically. Please contact support.',
          });
        }
        // Fall through to save the recovered account locally
      } else {
        const msg = err.response?.data?.message || err.message;
        return res.status(400).json({ message: `NIBSS account creation failed: ${msg}` });
      }
    }

    if (!nibssAccount?.accountNumber) {
      return res.status(400).json({ message: 'NIBSS did not return valid account details.' });
    }

    // ── Save account locally (covers both Scenario A and recovered Scenario C) ─
    const account = await Account.create({
      customerId: customer._id,
      accountNumber: nibssAccount.accountNumber,
      accountName: `${customer.firstName} ${customer.lastName}`,
      bankCode: nibssAccount.bankCode,
      bankName: process.env.BANK_NAME,
      balance: nibssAccount.balance ?? 15000,
    });

    // Mark onboarding as complete
    await Customer.findByIdAndUpdate(customer._id, { onboardingStatus: 'completed' });

    const isRecovered = false; // set true if came from Scenario C — for logging/audit
    res.status(201).json({
      message: 'Account created successfully.',
      account: {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankCode: account.bankCode,
        bankName: account.bankName,
        balance: account.balance,
      },
    });
  } catch (err) {
    // Handle duplicate key — race condition where two requests created the account simultaneously
    if (err.code === 11000) {
      const existing = await Account.findOne({ customerId: req.customer._id });
      return res.status(409).json({
        message: 'Account already exists.',
        account: existing,
      });
    }
    next(err);
  }
};

/**
 * POST /api/accounts/sync
 *
 * Explicit recovery endpoint — pulls the customer's NIBSS account into local DB.
 * Use this when createAccount self-recovery fails or for manual reconciliation.
 */
exports.syncAccount = async (req, res, next) => {
  try {
    const customer = req.customer;

    // Check if already synced
    const existingAccount = await Account.findOne({ customerId: customer._id });
    if (existingAccount) {
      // Already exists — just refresh balance from NIBSS
      try {
        const balanceRes = await nibssService.getBalance(existingAccount.accountNumber);
        const freshBalance = balanceRes.data?.balance ?? balanceRes.balance;
        if (freshBalance !== undefined) {
          existingAccount.balance = freshBalance;
          await existingAccount.save();
        }
      } catch (_) {}

      return res.json({
        message: 'Account already synced. Balance refreshed.',
        account: {
          accountNumber: existingAccount.accountNumber,
          accountName: existingAccount.accountName,
          bankCode: existingAccount.bankCode,
          bankName: existingAccount.bankName,
          balance: existingAccount.balance,
        },
      });
    }

    // Try to recover from NIBSS using getAllAccounts
    const nibssAccount = await recoverNibssAccount(customer);

    if (!nibssAccount?.accountNumber) {
      return res.status(404).json({
        message: 'No account found on NIBSS for this identity. Please create an account first.',
      });
    }

    const account = await Account.create({
      customerId: customer._id,
      accountNumber: nibssAccount.accountNumber,
      accountName: `${customer.firstName} ${customer.lastName}`,
      bankCode: nibssAccount.bankCode,
      bankName: nibssAccount.bankName,
      balance: nibssAccount.balance ?? 15000,
    });

    await Customer.findByIdAndUpdate(customer._id, { onboardingStatus: 'completed' });

    res.status(201).json({
      message: 'Account recovered and synced successfully.',
      account: {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankCode: account.bankCode,
        bankName: account.bankName,
        balance: account.balance,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Account.findOne({ customerId: req.customer._id });
      return res.json({ message: 'Account already synced.', account: existing });
    }
    next(err);
  }
};

/**
 * GET /api/accounts/me
 */
exports.getMyAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ customerId: req.customer._id });
    if (!account) {
      return res.status(404).json({
        message: 'No account found. Please create an account or call /api/accounts/sync to recover.',
      });
    }

    try {
      const nibssResponse = await nibssService.getBalance(account.accountNumber);
      const freshBalance = nibssResponse.data?.balance ?? nibssResponse.balance;
      if (freshBalance !== undefined) {
        account.balance = freshBalance;
        await account.save();
      }
    } catch (_) {
      // Non-fatal — return cached balance
    }

    res.json({ account });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/accounts/balance
 */
exports.getBalance = async (req, res, next) => {
  try {
    const account = await Account.findOne({ customerId: req.customer._id });
    if (!account) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    const nibssResponse = await nibssService.getBalance(account.accountNumber);
    const balance = nibssResponse.data?.balance ?? nibssResponse.balance ?? account.balance;

    account.balance = balance;
    await account.save();

    res.json({ accountNumber: account.accountNumber, balance });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/accounts/name-enquiry/:accountNumber
 */
exports.nameEnquiry = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;

    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(422).json({ message: 'Account number must be exactly 10 digits.' });
    }

    const nibssResponse = await nibssService.nameEnquiry(accountNumber);
    const result = nibssResponse.data || nibssResponse;

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/accounts/all
 */
exports.getAllAcounts = async(_req, res) => {
  try{
    const allAcounts =  await nibssService.getAllAccounts();
    return res.json(allAcounts);
  }catch(err){
    next(err);
  }
}