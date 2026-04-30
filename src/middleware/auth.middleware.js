const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');

/**
 * Protect routes — verifies the customer's own bank JWT (not NIBSS token).
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("active", decoded)

    const customer = await Customer.findById(decoded.id).select('-password');
    console.log(customer)
    if (!customer) {
      return res.status(401).json({ message: 'Token is invalid or user no longer exists.' });
    }

    if (!customer.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated.' });
    }

    req.customer = customer;
    next();
  } catch (error) {
  // console.log("JWT ERROR:", error.message);
  // console.log("JWT NAME:", error.name);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    if(error.name === "JsonWebTokenError"){
      return res.status(401).json({message: "Invalid signature"})
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

/**
 * Require that KYC is verified before accessing an endpoint.
 */
const requireKYC = (req, res, next) => {
  if (!req.customer.kycVerified) {
    return res.status(403).json({
      message: 'KYC verification required before accessing this feature.',
    });
  }
  next();
};

/**
 * Require that onboarding is fully completed.
 */
const requireOnboarded = (req, res, next) => {
  if (req.customer.onboardingStatus !== 'completed') {
    return res.status(403).json({
      message: 'Please complete your onboarding before using banking services.',
    });
  }
  next();
};

module.exports = { protect, requireKYC, requireOnboarded };
