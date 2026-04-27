const { body, validationResult } = require('express-validator');

/**
 * Runs after validation rules and returns 422 if any field failed.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth ────────────────────────────────────────────────────────────────────

const registerRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('dob')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date of birth must be in YYYY-MM-DD format'),
  body('kycType')
    .isIn(['bvn', 'nin'])
    .withMessage('kycType must be either "bvn" or "nin"'),
  body('kycID')
    .trim()
    .isLength({ min: 11, max: 11 })
    .withMessage('KYC ID must be exactly 11 digits'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Transfer ────────────────────────────────────────────────────────────────

const transferRules = [
  body('toAccount')
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('Recipient account number must be 10 digits'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  transferRules,
};
