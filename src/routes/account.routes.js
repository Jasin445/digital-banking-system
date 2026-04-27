const express = require('express');
const router = express.Router();

const {
  createAccount,
  syncAccount,
  getMyAccount,
  getBalance,
  nameEnquiry,
  getAllAcounts,
} = require('../controllers/account.controller');
const { protect, requireKYC } = require('../middleware/auth.middleware');

router.use(protect);

// POST /api/accounts/create
router.post('/create', requireKYC, createAccount);

// POST /api/accounts/sync — recover NIBSS account into local DB
router.post('/sync', requireKYC, syncAccount);

// GET /api/accounts/me
router.get('/me', getMyAccount);

// GET /api/accounts/balance
router.get('/balance', getBalance);

// GET /api/accounts/all
router.get('/all', getAllAcounts);

// GET /api/accounts/name-enquiry/:accountNumber
router.get('/name-enquiry/:accountNumber', nameEnquiry);

module.exports = router;
