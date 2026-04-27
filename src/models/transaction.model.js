const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    // Client-supplied idempotency key — unique per request from the client
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true, // only enforced when present
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // null until NIBSS confirms
      index: true,
    },
    type: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
    },
    transferType: {
      type: String,
      enum: ['intra-bank', 'inter-bank'],
      required: true,
    },
    fromAccount: {
      type: String,
      required: true,
    },
    toAccount: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
    },
    nibssTransactionId: {
      type: String,
      index: true,
    },
    description: {
      type: String,
    },
    failureReason: {
      type: String, // stores error message on failed transactions
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
