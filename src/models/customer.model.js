const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    dob: {
      type: String, // YYYY-MM-DD — kept as string to match NIBSS format
      required: [true, 'Date of birth is required'],
    },
    kycType: {
      type: String,
      enum: ['bvn', 'nin'],
      required: true,
    },
    kycID: {
      type: String,
      required: true,
      unique: true, // one BVN/NIN per customer in our system
    },
    kycVerified: {
      type: Boolean,
      default: false,
    },
    onboardingStatus: {
      type: String,
      enum: ['pending', 'verified', 'completed'],
      default: 'pending',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before save
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
customerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never expose kycID or password in JSON responses
customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.kycID;
  return obj;
};

module.exports = mongoose.model('Customer', customerSchema);
