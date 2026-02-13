const mongoose = require('mongoose');

const pushNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['manual', 'booking_created', 'booking_updated'],
    default: 'manual'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true,
    trim: true
  },
  targetAudience: {
    type: {
      type: String,
      enum: ['single_user', 'booking_id', 'service_zone', 'all_users', 'admins'],
      required: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }
  },
  deliveryType: {
    type: String,
    enum: ['push_only', 'push_sms'],
    default: 'push_only'
  },
  scheduledFor: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'sent', 'failed'],
    default: 'pending'
  },
  deliveryStatus: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceToken: { type: String },
    status: { type: String, enum: ['sent', 'failed', 'pending'] },
    error: { type: String },
    sentAt: { type: Date }
  }],
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipientUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deepLink: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
pushNotificationSchema.index({ status: 1, scheduledFor: 1 });
pushNotificationSchema.index({ sentBy: 1, createdAt: -1 });
pushNotificationSchema.index({ recipientUserIds: 1, createdAt: -1 });

module.exports = mongoose.model('PushNotification', pushNotificationSchema);
