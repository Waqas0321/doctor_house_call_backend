const User = require('../models/User');
const Booking = require('../models/Booking');
const Zone = require('../models/Zone');
const PushNotification = require('../models/PushNotification');

// Firebase Admin SDK (optional - install firebase-admin if using FCM)
let admin = null;
let fcmInitialized = false;

try {
  admin = require('firebase-admin');
  // Initialize Firebase Admin (if FCM is configured)
  if (process.env.FCM_SERVER_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FCM_PROJECT_ID,
          privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FCM_CLIENT_EMAIL
        })
      });
      fcmInitialized = true;
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
} catch (error) {
  console.warn('firebase-admin not installed. Push notifications will be disabled.');
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
  if (!fcmInitialized) {
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
exports.sendToUser = async (user, title, body, data = {}, deepLink = null) => {
  if (!user.pushNotificationSettings?.optIn) {
    return [];
  }

  const results = [];
  const activeDevices = user.devices.filter(
    device => device.lastActiveAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
  );

  for (const device of activeDevices) {
    const result = await sendToDevice(device.deviceToken, title, body, data, deepLink);
    results.push({
      userId: user._id,
      deviceToken: device.deviceToken,
      ...result
    });
  }

  return results;
};

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
    const userResults = await exports.sendToUser(user, title, body, data, deepLink);
    results.push(...userResults);
  }

  return results;
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
    title,
    body,
    targetAudience,
    deliveryType,
    scheduledFor,
    deepLink,
    sentBy: adminUser._id,
    status: scheduledFor ? 'scheduled' : 'pending'
  });

  // Send immediately if not scheduled
  if (!scheduledFor) {
    await exports.processNotification(notification);
  }

  return notification;
};

/**
 * Process and send a notification
 * @param {Object} notification - Notification document
 * @returns {Promise<void>}
 */
exports.processNotification = async (notification) => {
  let results = [];

  try {
    switch (notification.targetAudience.type) {
      case 'single_user':
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

      case 'booking_id':
        const booking = await Booking.findById(notification.targetAudience.bookingId);
        if (booking && booking.userId) {
          const bookingUser = await User.findById(booking.userId);
          if (bookingUser) {
            results = await exports.sendToUser(
              bookingUser,
              notification.title,
              notification.body,
              { bookingId: booking._id.toString() },
              notification.deepLink || `wdhc://booking/${booking._id}`
            );
          }
        }
        break;

      case 'service_zone':
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

      case 'all_users':
        results = await exports.sendBroadcast(
          notification.title,
          notification.body,
          {},
          notification.deepLink
        );
        break;
    }

    // Update notification status
    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.deliveryStatus = results;
    await notification.save();
  } catch (error) {
    console.error('Error processing notification:', error);
    notification.status = 'failed';
    await notification.save();
    throw error;
  }
};
