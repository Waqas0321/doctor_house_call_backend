const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['new', 'needs_review', 'confirmed', 'completed', 'cancelled'],
    default: 'new',
    index: true
  },
  visitType: {
    type: String,
    enum: ['phone_call', 'house_call'],
    required: true
  },
  // Address information
  address: {
    raw: { type: String, required: true },
    normalized: { type: String },
    street: { type: String },
    city: { type: String },
    province: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'Canada' }
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  unitBuzzer: {
    type: String,
    trim: true
  },
  accessInstructions: {
    type: String,
    trim: true
  },
  // Zone matching
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    index: true
  },
  matchedZoneName: {
    type: String
  },
  // Patient information (snapshot at booking time)
  patientInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    phin: { type: String },
    mhsc: { type: String }
  },
  familyMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  },
  // Contact information
  contactPhone: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  confirmationMethod: {
    type: String,
    enum: ['sms', 'email'],
    default: 'email'
  },
  // Visit details
  reasonForVisit: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Time window
  preferredTimeWindow: {
    start: { type: Date },
    end: { type: Date }
  },
  scheduledTime: {
    type: Date
  },
  // Admin override
  override: {
    isOverridden: { type: Boolean, default: false },
    originalZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    overrideZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    allowedVisitTypes: {
      phoneCall: { type: Boolean },
      houseCall: { type: Boolean }
    },
    reason: { type: String },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overriddenAt: { type: Date }
  },
  // Provider assignment
  assignedProvider: {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    providerName: { type: String }
  },
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Safety acknowledgements
  safetyAcknowledgements: {
    notForEmergencies: { type: Boolean, default: false },
    call911Acknowledged: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes for common queries
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ zoneId: 1, status: 1 });
bookingSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
