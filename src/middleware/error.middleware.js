/**
 * Central error handler — catches everything passed via next(err).
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `${field} already exists.` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ message: messages.join(', ') });
  }

  // Axios errors from NIBSS calls
  if (err.isAxiosError) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.message || 'NIBSS API error';
    return res.status(status).json({ message: `NIBSS: ${message}` });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler — mount AFTER all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
};

module.exports = { errorHandler, notFound };
