const Customer = require('../models/customer.model');
const nibssService = require('../services/nibss.service');
const { sendTokenResponse } = require('../utils/jwt.utils');

/**
 * NIBSS returns dob as ISO string "1990-12-05T00:00:00.000Z"
 * Customers submit "1990-12-05" — strip the time portion before comparing.
 */
const normaliseDate = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
};

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, dob, kycType, kycID } = req.body;

    // ── Step 1: Uniqueness checks ─────────────────────────────────────────────
    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const kycExists = await Customer.findOne({ kycID });
    if (kycExists) {
      return res.status(409).json({
        message: `This ${kycType.toUpperCase()} is already linked to an existing account.`,
      });
    }

    // ── Step 2: INSERT identity into NIBSS ────────────────────────────────────
    try {
      if (kycType === 'bvn') {
        await nibssService.insertBVN({ bvn: kycID, firstName, lastName, dob, phone });
      } else {
        await nibssService.insertNIN({ nin: kycID, firstName, lastName, dob });
      }
    } catch (insertErr) {
      const status = insertErr.response?.status;
      const msg = insertErr.response?.data?.message || insertErr.message;
      if (status !== 409) {
        return res.status(400).json({
          message: `Failed to register ${kycType.toUpperCase()} with NIBSS: ${msg}`,
        });
      }
    }

    // ── Step 3: VALIDATE identity from NIBSS ─────────────────────────────────
    // kycResponse declared outside if/else so it stays in scope after the block
    let kycResponse;
    try {
      if (kycType === 'bvn') {
        kycResponse = await nibssService.validateBVN(kycID);
      } else {
        kycResponse = await nibssService.validateNIN(kycID);
      }
    } catch (validateErr) {
      return res.status(400).json({
        message: `${kycType.toUpperCase()} validation failed: ${
          validateErr.response?.data?.message || validateErr.message
        }`,
      });
    }

    // Unwrap after the try/catch where kycResponse is in scope
    const kycData = kycResponse.data;

    if (!kycResponse.success || !kycData || !(kycData.bvn || kycData.nin)) {
      return res.status(400).json({
        message: `${kycType.toUpperCase()} could not be verified in NIBSS records.`,
      });
    }

    // ── Step 4: Cross-check name and DOB ─────────────────────────────────────
    const nibssFirst    = (kycData.firstName || '').toLowerCase().trim();
    const nibssLast     = (kycData.lastName  || '').toLowerCase().trim();
    const suppliedFirst = firstName.toLowerCase().trim();
    const suppliedLast  = lastName.toLowerCase().trim();

    if (nibssFirst !== suppliedFirst || nibssLast !== suppliedLast) {
      return res.status(400).json({
        message: 'Name does not match the identity on record. Please use your legal name.',
      });
    }

    if (normaliseDate(kycData.dob) !== dob) {
      return res.status(400).json({
        message: 'Date of birth does not match the identity on record.',
      });
    }

    // ── Step 5: Save customer locally ─────────────────────────────────────────
    const customer = await Customer.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      dob,
      kycType,
      kycID,
      kycVerified: true,
      onboardingStatus: 'verified',
    });

    // ── Step 6: Return JWT ────────────────────────────────────────────────────
    sendTokenResponse(customer, 201, res, {
      message: 'Registration successful. Please create your bank account to complete onboarding.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email }).select('+password');
    if (!customer || !(await customer.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!customer.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated.' });
    }

    sendTokenResponse(customer, 200, res, { message: 'Login successful.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  res.json({ customer: req.customer });
};
