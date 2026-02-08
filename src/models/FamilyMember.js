const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fullName: {
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
  dob: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  phin: {
    type: String,
    trim: true
  },
  mhsc: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for user's family members lookup
familyMemberSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
