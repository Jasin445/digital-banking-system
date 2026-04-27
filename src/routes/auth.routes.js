const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { registerRules, loginRules, validate } = require('../middleware/validation.middleware');

// POST /api/auth/register
router.post('/register', registerRules, validate, register);

// POST /api/auth/login
router.post('/login', loginRules, validate, login);

// GET /api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
