const express = require('express');
const router = express.Router();

const {
  transfer,
  getMyTransactions,
  getTransactionById,
  getTransactionStatus,
} = require('../controllers/transaction.controller');
const { protect, requireOnboarded } = require('../middleware/auth.middleware');
const { transferRules, validate } = require('../middleware/validation.middleware');

// All transaction routes require authentication + completed onboarding
router.use(protect, requireOnboarded);

// POST /api/transactions/transfer
router.post('/transfer', transferRules, validate, transfer);

// GET /api/transactions — own history only
router.get('/', getMyTransactions);

// GET /api/transactions/status/:nibssTransactionId — TSQ via NIBSS
router.get('/status/:nibssTransactionId', getTransactionStatus);

// GET /api/transactions/:transactionId — single transaction (own only)
router.get('/:transactionId', getTransactionById);

module.exports = router;
