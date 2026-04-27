const jwt = require('jsonwebtoken');

/**
 * Sign a JWT for a customer session.
 */
const signToken = (customerId) => {
  return jwt.sign({ id: customerId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Send token in JSON response.
 */
const sendTokenResponse = (customer, statusCode, res, extraData = {}) => {
  const token = signToken(customer._id);
  res.status(statusCode).json({
    token,
    customer,
    ...extraData,
  });
};

module.exports = { signToken, sendTokenResponse };
