require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n --- Digital Bank API running on port ${PORT} ---`);
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health: ${
      process.env.NODE_ENV === 'production'
        ? `https://${process.env.NIBSS_BASE_URL || 'https://nibssbyphoenix.onrender.com'}/health`
        : `http://localhost:${PORT}/health`
    }`);
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});
