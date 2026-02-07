const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  authProvider: {
    type: String,
    enum: ['google', 'facebook', 'apple', 'email'],
    default: 'email'
  },
  providerUserId: {
    type: String,
    sparse: true // Allow null for email/password users
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    required: function() {
      return this.authProvider === 'email';
    }
  },
  address: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    select: false, // Don't return password by default
    minlength: 6,
    required: function() {
      return this.authProvider === 'email';
    }
  },
  phone: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String
  },
  consentFlags: {
    termsAccepted: { type: Boolean, default: false },
    privacyAccepted: { type: Boolean, default: false },
    marketingConsent: { type: Boolean, default: false }
  },
  pushNotificationSettings: {
    optIn: { type: Boolean, default: false },
    appointmentUpdates: { type: Boolean, default: true },
    serviceAnnouncements: { type: Boolean, default: false }
  },
  devices: [{
    deviceToken: { type: String, required: true },
    deviceType: { type: String, enum: ['ios', 'android'], required: true },
    lastActiveAt: { type: Date, default: Date.now }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving (only for email/password users)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password || !enteredPassword) {
    return false;
  }
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Compound index for OAuth provider lookup (sparse for email users)
userSchema.index({ authProvider: 1, providerUserId: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
