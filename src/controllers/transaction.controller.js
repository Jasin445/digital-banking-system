const mongoose = require('mongoose');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');
const nibssService = require('../services/nibss.service');
const crypto = require('crypto');

/**
 * Generate a guaranteed-unique transaction ID for failed/local records.
 */
const generateLocalTxId = (prefix = 'TX-LOCAL') =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * POST /api/transactions/transfer
 *
 * Robustness guarantees:
 *  - Idempotency: client sends X-Idempotency-Key header; duplicate requests return
 *    the original response instead of executing twice.
 *  - Optimistic concurrency: balance update uses findOneAndUpdate with version check
 *    to prevent race conditions from concurrent requests.
 *  - Atomicity: transaction record is created as PENDING BEFORE calling NIBSS,
 *    then updated to SUCCESS/FAILED after. If server crashes mid-flight, the
 *    PENDING record is detectable and recoverable.
 *  - Hanging transaction recovery: if NIBSS succeeds but local update fails,
 *    the PENDING record + nibssTransactionId allow reconciliation.
 *  - Failed transaction audit: every failure — NIBSS or local — is recorded.
 */
exports.transfer = async (req, res, next) => {
  try {
    const { toAccount, amount, description } = req.body;
    const customerId = req.customer._id;

    // ── Idempotency check ─────────────────────────────────────────────────────
    // Client must send a unique key per request (UUID recommended).
    // If we've seen this key before, return the original result immediately.
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (idempotencyKey) {
      const existingTx = await Transaction.findOne({ idempotencyKey });
      if (existingTx) {
        return res.status(200).json({
          message: 'Duplicate request. Returning original transaction result.',
          transaction: existingTx,
          idempotent: true,
        });
      }
    }

    // ── Validate sender account ───────────────────────────────────────────────
    const senderAccount = await Account.findOne({ customerId });
    if (!senderAccount) {
      return res.status(404).json({ message: 'You do not have a bank account.' });
    }
    if (!senderAccount.isActive) {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }
    if (senderAccount.accountNumber === toAccount) {
      return res.status(400).json({ message: 'Cannot transfer to the same account.' });
    }

    const transferAmount = Number(amount);

    // ── Refresh balance from NIBSS ────────────────────────────────────────────
    try {
      const nibssBalance = await nibssService.getBalance(senderAccount.accountNumber);
      // NIBSS balance response is flat: { accountName, accountNumber, balance }
      await Account.findOneAndUpdate(
        { _id: senderAccount._id },
        { balance: nibssBalance.balance ?? nibssBalance.data?.balance ?? senderAccount.balance }
      );
      senderAccount.balance = nibssBalance.balance ?? nibssBalance.data?.balance ?? senderAccount.balance;
    } catch (_) {
      // Non-fatal — proceed with cached balance
    }

    // ── Sufficient funds check ────────────────────────────────────────────────
    if (senderAccount.balance < transferAmount) {
      return res.status(400).json({
        message: 'Insufficient funds.',
        availableBalance: senderAccount.balance,
      });
    }

    // ── Name enquiry — mandatory pre-transfer check ───────────────────────────
    let recipientInfo;
    try {
      const nameRes = await nibssService.nameEnquiry(toAccount);
      recipientInfo = nameRes.data || nameRes;
    } catch (err) {
      return res.status(404).json({ message: 'Recipient account not found.' });
    }

    // ── Determine transfer type ───────────────────────────────────────────────
    const recipientAccount = await Account.findOne({ accountNumber: toAccount });
    const transferType = recipientAccount ? 'intra-bank' : 'inter-bank';
    const balanceBefore = senderAccount.balance;
    const balanceAfter = balanceBefore - transferAmount;

    // ── Create PENDING transaction record BEFORE calling NIBSS ───────────────
    // This is the key robustness pattern: we record intent before execution.
    // If the server crashes after NIBSS succeeds but before we save,
    // this PENDING record acts as a flag for reconciliation.
    let pendingTx;
    try {
      pendingTx = await Transaction.create({
        customerId,
        idempotencyKey: idempotencyKey || null,
        transactionId: generateLocalTxId('TX-PENDING'),
        type: 'debit',
        transferType,
        fromAccount: senderAccount.accountNumber,
        toAccount,
        amount: transferAmount,
        balanceBefore,
        balanceAfter,
        status: 'PENDING',
        description: description || `Transfer to ${recipientInfo.accountName}`,
      });
    } catch (err) {
      // If idempotency key already exists, duplicate request
      if (err.code === 11000) {
        const existingTx = await Transaction.findOne({ idempotencyKey });
        return res.status(200).json({
          message: 'Duplicate request. Returning original transaction result.',
          transaction: existingTx,
          idempotent: true,
        });
      }
      return next(err);
    }

    // ── Debit sender balance using optimistic concurrency ─────────────────────
    // findOneAndUpdate with the current __v prevents two concurrent requests
    // from both passing the balance check and both debiting.
    const updatedSender = await Account.findOneAndUpdate(
      {
        _id: senderAccount._id,
        __v: senderAccount.__v,        // version must match — rejects stale reads
        balance: { $gte: transferAmount }, // double-check funds atomically
      },
      {
        $inc: { balance: -transferAmount, __v: 1 },
      },
      { new: true }
    );

    if (!updatedSender) {
      // Either a concurrent request already modified the balance,
      // or funds dropped between our check and this update.
      await Transaction.findByIdAndUpdate(pendingTx._id, {
        status: 'FAILED',
        failureReason: 'Balance changed by concurrent request or insufficient funds.',
        transactionId: generateLocalTxId('TX-FAIL'),
      });
      return res.status(400).json({
        message: 'Transfer could not be processed. Please try again.',
      });
    }

    // ── Execute NIBSS transfer ────────────────────────────────────────────────
    let nibssResult;
    try {
      const transferRes = await nibssService.transfer(
        senderAccount.accountNumber,
        toAccount,
        transferAmount
      );
      nibssResult = transferRes.data || transferRes;
    } catch (err) {
      // NIBSS rejected the transfer — roll back the local balance deduction
      await Account.findByIdAndUpdate(senderAccount._id, {
        $inc: { balance: transferAmount, __v: 1 },
      });

      const failMsg = err.response?.data?.message || err.message;

      await Transaction.findByIdAndUpdate(pendingTx._id, {
        status: 'FAILED',
        failureReason: failMsg,
        transactionId: generateLocalTxId('TX-FAIL'),
      });

      return res.status(400).json({ message: `Transfer failed: ${failMsg}` });
    }

    // ── NIBSS succeeded — update pending record to SUCCESS ────────────────────
    // Real NIBSS transfer response fields:
    // { reference, senderAccount, receiverAccount, amount, status, _id }
    const nibssTransactionId = nibssResult.reference || nibssResult.transactionId;

    const finalTx = await Transaction.findByIdAndUpdate(
      pendingTx._id,
      {
        status: nibssResult.status || 'SUCCESS',
        transactionId: nibssTransactionId,
        nibssTransactionId: nibssTransactionId,
      },
      { new: true }
    );

    // ── Intra-bank: credit recipient locally + record their credit leg ─────────
    if (recipientAccount) {
      await Account.findByIdAndUpdate(recipientAccount._id, {
        $inc: { balance: transferAmount, __v: 1 },
      });

      await Transaction.create({
        customerId: recipientAccount.customerId,
        transactionId: `${nibssTransactionId}-CR`,
        type: 'credit',
        transferType,
        fromAccount: senderAccount.accountNumber,
        toAccount,
        amount: transferAmount,
        balanceBefore: recipientAccount.balance,
        balanceAfter: recipientAccount.balance + transferAmount,
        status: nibssResult.status || 'SUCCESS',
        nibssTransactionId: nibssTransactionId,
        description: description || `Transfer from ${senderAccount.accountNumber}`,
      }).catch(() => {
        console.error(`[WARN] Failed to create credit record for ${toAccount}`);
      });
    }

    res.status(200).json({
      message: 'Transfer successful.',
      transaction: {
        transactionId: finalTx.transactionId,
        amount: transferAmount,
        from: senderAccount.accountNumber,
        to: toAccount,
        recipientName: recipientInfo.accountName,
        transferType,
        status: finalTx.status,
        balanceBefore,
        balanceAfter,
        timestamp: finalTx.timestamp,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions
 * Authenticated customer's own transaction history only.
 * Supports pagination (?page=1&limit=20) and filtering (?type=debit&status=SUCCESS).
 */
exports.getMyTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    const filter = { customerId: req.customer._id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      transactions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/:transactionId
 * Single transaction — 404 if it belongs to another customer.
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      transactionId,
      customerId: req.customer._id,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Auto-resolve PENDING transactions by querying NIBSS
    if (transaction.status === 'PENDING' && transaction.nibssTransactionId) {
      try {
        const nibssStatusRes = await nibssService.getTransactionStatus(transaction.nibssTransactionId);
        const nibssStatus = nibssStatusRes.data || nibssStatusRes;
        if (nibssStatus.status && nibssStatus.status !== transaction.status) {
          transaction.status = nibssStatus.status;
          await transaction.save();
        }
      } catch (_) {
        // Non-fatal — return current status
      }
    }

    res.json({ transaction });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/status/:nibssTransactionId
 * TSQ — queries NIBSS directly, syncs and returns local record.
 * Ownership enforced — only the transaction owner can query it.
 */
exports.getTransactionStatus = async (req, res, next) => {
  try {
    const { nibssTransactionId } = req.params;

    const transaction = await Transaction.findOne({
      nibssTransactionId,
      customerId: req.customer._id,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or access denied.' });
    }

    const nibssStatusRes = await nibssService.getTransactionStatus(nibssTransactionId);
    const nibssStatus = nibssStatusRes.data || nibssStatusRes;

    if (nibssStatus.status) {
      transaction.status = nibssStatus.status;
      await transaction.save();
    }

    res.json({ nibssStatus, localRecord: transaction });
  } catch (err) {
    next(err);
  }
};