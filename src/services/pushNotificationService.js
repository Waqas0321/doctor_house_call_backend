const User = require('../models/User');
const Booking = require('../models/Booking');
const PushNotification = require('../models/PushNotification');

/**
 * In-app / admin-feed notifications only (no FCM / no mobile push).
 * Records are stored for GET /api/admin/notifications and GET /api/notifications.
 */

async function recipientIdsForAudience(targetAudience) {
  const ta = targetAudience || {};
  switch (ta.type) {
    case 'single_user':
      if (ta.userId) return [ta.userId];
      return [];
    case 'booking_id': {
      const booking = await Booking.findById(ta.bookingId).select('userId').lean();
      if (booking?.userId) return [booking.userId];
      return [];
    }
    case 'service_zone': {
      const userIds = await Booking.find({ zoneId: ta.zoneId }).distinct('userId');
      const users = await User.find({
        _id: { $in: userIds },
        'pushNotificationSettings.optIn': true,
        'pushNotificationSettings.serviceAnnouncements': true
      })
        .select('_id')
        .lean();
      return users.map((u) => u._id);
    }
    case 'all_users': {
      const users = await User.find({
        'pushNotificationSettings.optIn': true,
        'pushNotificationSettings.serviceAnnouncements': true
      })
        .select('_id')
        .lean();
      return users.map((u) => u._id);
    }
    case 'admins': {
      const admins = await User.find({ isAdmin: true, isActive: true }).select('_id').lean();
      return admins.map((a) => a._id);
    }
    default:
      return [];
  }
}

exports.createAdminNotification = async (notificationData, adminUser) => {
  const { title, body, targetAudience, deliveryType, scheduledFor, deepLink } = notificationData;

  const notification = await PushNotification.create({
    type: 'manual',
    title,
    body,
    targetAudience,
    deliveryType,
    scheduledFor,
    deepLink,
    sentBy: adminUser._id,
    status: scheduledFor ? 'scheduled' : 'pending'
  });

  if (!scheduledFor) {
    await exports.processNotification(notification);
  }
  return notification;
};

exports.processNotification = async (notification) => {
  try {
    const recipientUserIds = await recipientIdsForAudience(notification.targetAudience);

    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.deliveryStatus = [];
    notification.recipientUserIds = recipientUserIds;
    await notification.save();
  } catch (error) {
    console.error('Error processing notification:', error);
    notification.status = 'failed';
    await notification.save();
  }
};

exports.notifyAdminsBookingCreated = async (booking) => {
  try {
    const patientName =
      [booking.patientInfo?.firstName, booking.patientInfo?.lastName].filter(Boolean).join(' ') ||
      'Patient';
    const title = 'New Booking Alert';
    const body = `You have received a new booking request from ${patientName}`;
    const recipientUserIds = await recipientIdsForAudience({ type: 'admins' });

    return await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'admins' },
      status: 'sent',
      sentAt: new Date(),
      deliveryStatus: [],
      recipientUserIds
    });
  } catch (e) {
    console.error('Error notifying admins:', e.message);
  }
};

exports.notifyUserBookingCreatedByAdmin = async (booking) => {
  try {
    if (!booking.userId) return null;
    const title = 'Booking Created';
    const body = 'A booking has been created for you. Check your email for details.';

    return await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: 'sent',
      sentAt: new Date(),
      deliveryStatus: [],
      recipientUserIds: [booking.userId],
      sentBy: null
    });
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};

exports.notifyUserBookingUpdated = async (booking, oldStatus, newStatus) => {
  try {
    if (!booking.userId) return null;
    const title = 'Booking Update';
    const body = `Your booking status has been updated to ${newStatus}.`;

    return await PushNotification.create({
      type: 'booking_updated',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: 'sent',
      sentAt: new Date(),
      deliveryStatus: [],
      recipientUserIds: [booking.userId]
    });
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};
