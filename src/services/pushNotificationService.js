const User = require('../models/User');
const Booking = require('../models/Booking');
const Zone = require('../models/Zone');
const PushNotification = require('../models/PushNotification');

// Firebase Admin SDK for FCM
let admin = null;
let fcmInitialized = false;

/** Devices older than this are skipped (tokens may be invalid). */
const DEVICE_ACTIVE_MS =
  parseInt(process.env.FCM_DEVICE_MAX_AGE_DAYS || '365', 10) * 24 * 60 * 60 * 1000;

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
      const key = process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');
      cred = admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        privateKey: key,
        clientEmail: process.env.FCM_CLIENT_EMAIL
      });
    }
    if (cred) {
      admin.initializeApp({ credential: cred });
      fcmInitialized = true;
    }
  } catch (e) {
    console.warn('FCM init skipped:', e.message);
    fcmInitialized = false;
    admin = null;
  }
  return fcmInitialized;
}

/** FCM data payload: every value must be a non-empty string. */
function stringifyFcmData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === null) continue;
    out[String(k)] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

function deliveryRow(userId, deviceToken, sendResult) {
  return {
    userId: userId || undefined,
    deviceToken: deviceToken || undefined,
    status: sendResult.success ? 'sent' : 'failed',
    error: sendResult.success ? undefined : sendResult.error,
    sentAt: new Date()
  };
}

function anyDeliverySucceeded(rows) {
  return Array.isArray(rows) && rows.some((r) => r.status === 'sent');
}

/**
 * sent = at least one device got the push.
 * skipped = nothing was attempted (no devices / no opt-in / no matching users).
 * failed = we tried (or infra misconfigured e.g. FCM) but nothing succeeded.
 */
function finalizeOutcomeFromDeliveryResults(results) {
  if (anyDeliverySucceeded(results)) {
    return { status: 'sent', deliveryStatus: results };
  }
  if (!results || results.length === 0) {
    return {
      status: 'skipped',
      deliveryStatus: [
        {
          status: 'skipped',
          error:
            'No push was sent: recipient may have push disabled, no FCM device registered, or no users matched the audience.',
          sentAt: new Date()
        }
      ]
    };
  }
  return { status: 'failed', deliveryStatus: results };
}

function filterActiveDevices(devices) {
  if (!devices?.length) return [];
  const cutoff = Date.now() - DEVICE_ACTIVE_MS;
  return devices.filter((d) => {
    if (!d?.deviceToken) return false;
    if (!d.lastActiveAt) return true;
    const t = new Date(d.lastActiveAt).getTime();
    return Number.isFinite(t) && t > cutoff;
  });
}

/**
 * Send push notification to a single device
 */
const sendToDevice = async (deviceToken, title, body, data = {}, deepLink = null) => {
  if (!initFCM() || !admin) {
    console.warn('FCM not initialized, skipping push notification');
    return { success: false, error: 'FCM not configured' };
  }

  try {
    const dataPayload = stringifyFcmData({
      ...data,
      ...(deepLink ? { deepLink } : {})
    });

    const message = {
      notification: { title, body },
      data: dataPayload,
      token: deviceToken,
      android: { priority: 'high' },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error.message || error);
    return { success: false, error: error.message || String(error) };
  }
};

/**
 * Send push notification to user's devices
 */
const sendToUserDevices = async (user, title, body, data = {}, deepLink = null, bypassOptIn = false) => {
  if (!bypassOptIn && !user.pushNotificationSettings?.optIn) return [];
  const results = [];
  const activeDevices = filterActiveDevices(user.devices || []);

  for (const device of activeDevices) {
    const sendResult = await sendToDevice(device.deviceToken, title, body, data, deepLink);
    results.push(deliveryRow(user._id, device.deviceToken, sendResult));
  }
  return results;
};

exports.sendToUser = (user, title, body, data = {}, deepLink = null) =>
  sendToUserDevices(user, title, body, data, deepLink, false);

exports.sendToZone = async (zone, title, body, data = {}, deepLink = null) => {
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
 * Send push to all admin users (bypasses notification opt-in).
 * Returns delivery rows; includes diagnostic rows when nothing could be sent.
 */
exports.sendToAdmins = async (title, body, data = {}, deepLink = null) => {
  if (!initFCM() || !admin) {
    return [
      {
        status: 'failed',
        error:
          'FCM not configured. Set FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT JSON) on the server.',
        sentAt: new Date()
      }
    ];
  }

  const adminUsers = await User.find({ isAdmin: true, isActive: true }).select('devices email');
  if (!adminUsers.length) {
    return [
      {
        status: 'failed',
        error: 'No active admin users found in the database.',
        sentAt: new Date()
      }
    ];
  }

  const results = [];
  for (const u of adminUsers) {
    const rows = await sendToUserDevices(u, title, body, data, deepLink, true);
    results.push(...rows);
  }

  const totalRegistered = adminUsers.reduce((n, u) => n + (u.devices?.length || 0), 0);

  if (results.length === 0 && totalRegistered > 0) {
    return [
      {
        status: 'failed',
        error: `All ${totalRegistered} admin device registration(s) are older than ${DEVICE_ACTIVE_MS / (24 * 60 * 60 * 1000)} days or invalid. Re-open the admin app to refresh FCM (POST /api/auth/device).`,
        sentAt: new Date()
      }
    ];
  }

  if (results.length === 0) {
    return [
      {
        status: 'failed',
        error:
          'No admin push endpoints registered. Admin web portal: use Firebase Messaging for Web, then POST /api/auth/device with deviceToken and deviceType "web". Mobile admins use ios|android.',
        sentAt: new Date()
      }
    ];
  }

  return results;
};

exports.sendToUserForBooking = async (user, title, body, data = {}, deepLink = null) => {
  const optIn = user.pushNotificationSettings?.optIn;
  const appointmentUpdates = user.pushNotificationSettings?.appointmentUpdates !== false;
  if (!optIn || !appointmentUpdates) return [];
  return sendToUserDevices(user, title, body, data, deepLink, true);
};

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

const collectRecipientIds = (results) =>
  [...new Set(results.map((r) => r.userId?.toString()).filter(Boolean))];

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
      default:
        break;
    }

    const outcome = finalizeOutcomeFromDeliveryResults(results);
    notification.status = outcome.status;
    notification.sentAt = new Date();
    notification.deliveryStatus = outcome.deliveryStatus;
    notification.recipientUserIds = collectRecipientIds(outcome.deliveryStatus);
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
    const results = await exports.sendToAdmins(
      title,
      body,
      { bookingId: booking._id.toString() },
      `wdhc://booking/${booking._id}`
    );
    const outcome = finalizeOutcomeFromDeliveryResults(results);
    const notification = await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'admins' },
      status: outcome.status,
      sentAt: new Date(),
      deliveryStatus: outcome.deliveryStatus,
      recipientUserIds: collectRecipientIds(outcome.deliveryStatus)
    });
    return notification;
  } catch (e) {
    console.error('Error notifying admins:', e.message);
  }
};

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
    const outcome = finalizeOutcomeFromDeliveryResults(results);
    const notification = await PushNotification.create({
      type: 'booking_created',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: outcome.status,
      sentAt: new Date(),
      deliveryStatus: outcome.deliveryStatus,
      recipientUserIds: [booking.userId],
      sentBy: null
    });
    return notification;
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};

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
    const outcome = finalizeOutcomeFromDeliveryResults(results);
    const notification = await PushNotification.create({
      type: 'booking_updated',
      title,
      body,
      targetAudience: { type: 'booking_id', bookingId: booking._id },
      status: outcome.status,
      sentAt: new Date(),
      deliveryStatus: outcome.deliveryStatus,
      recipientUserIds: [booking.userId]
    });
    return notification;
  } catch (e) {
    console.error('Error notifying user:', e.message);
  }
};
