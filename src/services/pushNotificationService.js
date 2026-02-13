const User = require('../models/User');
const Booking = require('../models/Booking');
const Zone = require('../models/Zone');
const PushNotification = require('../models/PushNotification');

// Firebase Admin SDK for FCM
let admin = null;
let fcmInitialized = false;

function initFCM() {
  if (fcmInitialized) return true;
  try {
    admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      fcmInitialized = true;
      return true;
    }
    let cred;
    if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{')) {
      cred = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else if (process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY && process.env.FCM_CLIENT_EMAIL) {
      cred = admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FCM_CLIENT_EMAIL
      });
    }
    if (cred) {
      admin.initializeApp({ credential: cred });
      fcmInitialized = true;
    }
  } catch (e) {
    console.warn('FCM init skipped:', e.message);
  }
  return fcmInitialized;
}

/**
 * Send push notification to a single device
 * @param {string} deviceToken - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @param {string} deepLink - Deep link URL
 * @returns {Promise<Object>} Result object
 */
const sendToDevice = async (deviceToken, title, body, data = {}, deepLink = null) => {
  if (!initFCM() || !admin) {
    console.warn('FCM not initialized, skipping push notification');
    return { success: false, error: 'FCM not configured' };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        ...(deepLink && { deepLink })
      },
      token: deviceToken
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to user's devices
 * @param {Object} user - User object
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @param {string} deepLink - Deep link URL
 * @returns {Promise<Array>} Results array
 */
const sendToUserDevices = async (user, title, body, data = {}, deepLink = null, bypassOptIn = false) => {
  if (!bypassOptIn && !user.pushNotificationSettings?.optIn) return [];
  const results = [];
  const devices = user.devices || [];
  const activeDevices = devices.filter(
    device => device.lastActiveAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
  );

  for (const device of activeDevices) {
    const result = await sendToDevice(device.deviceToken, title, body, data, deepLink);
    results.push({ userId: user._id, deviceToken: device.deviceToken, ...result });
  }
  return results;
};

exports.sendToUser = (user, title, body, data = {}, deepLink = null) =>
  sendToUserDevices(user, title, body, data, deepLink, false);

/**
 * Send notification to users in a zone
 * @param {Object} zone - Zone object
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @param {string} deepLink - Deep link URL
 * @returns {Promise<Array>} Results array
 */
exports.sendToZone = async (zone, title, body, data = {}, deepLink = null) => {
  // Find all users with bookings in this zone
  const bookings = await Booking.find({ zoneId: zone._id }).distinct('userId');
  const users = await User.find({
    _id: { $in: bookings },
    'pushNotificationSettings.optIn': true,
    'pushNotificationSettings.serviceAnnouncements': true
  });

  const results = [];
  for (const user of users) {
    const userResults = await exports.sendToUser(user, title, body, data, deepLink);
    results.push(...userResults);
  }

  return results;
};

/**
 * Send broadcast notification to all users
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @param {string} deepLink - Deep link URL
 * @returns {Promise<Array>} Results array
 */
exports.sendBroadcast = async (title, body, data = {}, deepLink = null) => {
  const users = await User.find({
    'pushNotificationSettings.optIn': true,
    'pushNotificationSettings.serviceAnnouncements': true
  });
  const results = [];
  for (const user of users) {
    results.push(...(await exports.sendToUser(user, title, body, data, deepLink)));
  }
  return results;
};

/**
 * Send push notification to all admin users (bypasses optIn for admin alerts)
 */
exports.sendToAdmins = async (title, body, data = {}, deepLink = null) => {
  const adminUsers = await User.find({ isAdmin: true, isActive: true }).select('devices');
  const results = [];
  for (const u of adminUsers) {
    results.push(...(await sendToUserDevices(u, title, body, data, deepLink, true)));
  }
  return results;
};

/**
 * Send to user for appointment updates (bypasses optIn if appointmentUpdates is true)
 */
exports.sendToUserForBooking = async (user, title, body, data = {}, deepLink = null) => {
  const optIn = user.pushNotificationSettings?.optIn;
  const appointmentUpdates = user.pushNotificationSettings?.appointmentUpdates !== false;
  if (!optIn || !appointmentUpdates) return [];
  return sendToUserDevices(user, title, body, data, deepLink, true);
};

/**
 * Create and send admin notification
 * @param {Object} notificationData - Notification data
 * @param {Object} adminUser - Admin user object
 * @returns {Promise<Object>} Created notification document
 */
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

const collectRecipientIds = (results) => [...new Set(results.map(r => r.userId?.toString()).filter(Boolean))];

/**
 * Process and send a notification
 */
exports.processNotification = async (notification) => {
  let results = [];
  try {
    switch (notification.targetAudience?.type) {
      case 'single_user': {
        const user = await User.findById(notification.targetAudience.userId);
        if (user) {
          results = await exports.sendToUser(
            user,
            notification.title,
            notification.body,
            {},
            notification.deepLink
          );
        }
        break;
      }
      case 'booking_id': {
        const booking = await Booking.findById(notification.targetAudience.bookingId).populate('userId');
        if (booking?.userId) {
          results = await exports.sendToUserForBooking(
            booking.userId,
            notification.title,
            notification.body,
            { bookingId: booking._id.toString() },
            notification.deepLink || `wdhc://booking/${booking._id}`
          );
        }
        break;
      }
      case 'service_zone': {
        const zone = await Zone.findById(notification.targetAudience.zoneId);
        if (zone) {
          results = await exports.sendToZone(
            zone,
            notification.title,
            notification.body,
            {},
            notification.deepLink
          );
        }
        break;
      }
      case 'all_users':
        results = await exports.sendBroadcast(
          notification.title,
          notification.body,
          {},
          notification.deepLink
        );
        break;
    }

    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.deliveryStatus = results;
    notification.recipientUserIds = collectRecipientIds(results);
    await notification.save();
  } catch (error) {
    console.error('Error processing notification:', error);
    notification.status = 'failed';
    await notification.save();
  }
};

/**
 * Notify admins when a booking is created by app user
 */
exports.notifyAdminsBookingCreated = async (booking) => {
  try {
    const patientName = [booking.patientInfo?.firstName, booking.patientInfo?.lastName].filter(Boolean).join(' ') || 'Patient';
    const title = 'New Booking Alert';
    const body = `You have received a new booking request from ${patientName}`;
    const results = await exports.sendToAdmins(title, body, { bookingId: booking._id.toString() }, `wdhc://booking/${booking._id}`);
    const notification = await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'admins' },
      status: results.length ? 'sent' : 'failed',
      sentAt: new Date(),
      deliveryStatus: results,
      recipientUserIds: collectRecipientIds(results)
    });
    return notification;
  } catch (e) {
    console.error('Error notifying admins:', e.message);
  }
};

/**
 * Notify user when admin creates a booking for them
 */
exports.notifyUserBookingCreatedByAdmin = async (booking) => {
  try {
    if (!booking.userId) return null;
    const user = await User.findById(booking.userId).select('devices pushNotificationSettings');
    if (!user?.devices?.length) return null;
    const title = 'Booking Created';
    const body = 'A booking has been created for you. Check your email for details.';
    const results = await exports.sendToUserForBooking(
      user,
      title,
      body,
      { bookingId: booking._id.toString() },
      `wdhc://booking/${booking._id}`
    );
    const notification = await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: results.length ? 'sent' : 'failed',
      sentAt: new Date(),
      deliveryStatus: results,
      recipientUserIds: [booking.userId],
      sentBy: null
    });
    return notification;
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};

/**
 * Notify user when admin updates their booking
 */
exports.notifyUserBookingUpdated = async (booking, oldStatus, newStatus) => {
  try {
    if (!booking.userId) return null;
    const user = await User.findById(booking.userId).select('devices pushNotificationSettings');
    if (!user?.devices?.length) return null;
    const title = 'Booking Update';
    const body = `Your booking status has been updated to ${newStatus}.`;
    const results = await exports.sendToUserForBooking(
      user,
      title,
      body,
      { bookingId: booking._id.toString() },
      `wdhc://booking/${booking._id}`
    );
    const notification = await PushNotification.create({
      type: 'booking_updated',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: results.length ? 'sent' : 'failed',
      sentAt: new Date(),
      deliveryStatus: results,
      recipientUserIds: [booking.userId]
    });
    return notification;
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};
