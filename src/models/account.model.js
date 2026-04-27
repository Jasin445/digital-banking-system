const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    bankCode: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      default: 15000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optimistic concurrency version key — prevents race conditions on balance updates
    __v: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // mongoose built-in — increments __v on every save
  }
);

module.exports = mongoose.model('Account', accountSchema);
