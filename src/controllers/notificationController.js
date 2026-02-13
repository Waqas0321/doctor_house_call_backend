const PushNotification = require('../models/PushNotification');
const User = require('../models/User');
const { createAdminNotification } = require('../services/pushNotificationService');

/**
 * @desc    Get all notifications (admin)
 * @route   GET /api/admin/notifications
 * @access  Private/Admin
 */
exports.getAllNotifications = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const notifications = await PushNotification.find(filter)
      .populate('sentBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const total = notifications.length;
    const sent = notifications.filter((n) => n.status === 'sent').length;
    const draft = notifications.filter((n) => n.status === 'pending' || n.status === 'scheduled').length;
    const failed = notifications.filter((n) => n.status === 'failed').length;

    res.status(200).json({
      success: true,
      count: total,
      stats: { total, sent, draft, failed },
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create manual notification (admin)
 * @route   POST /api/admin/notifications
 * @access  Private/Admin
 */
exports.createNotification = async (req, res, next) => {
  try {
    const { title, body, targetAudience, deliveryType, scheduledFor, deepLink } = req.body;

    if (!title || !body || !targetAudience?.type) {
      return res.status(400).json({
        success: false,
        error: 'title, body, and targetAudience.type are required'
      });
    }

    const validTypes = ['single_user', 'booking_id', 'service_zone', 'all_users'];
    if (!validTypes.includes(targetAudience.type)) {
      return res.status(400).json({
        success: false,
        error: 'targetAudience.type must be single_user, booking_id, service_zone, or all_users'
      });
    }

    const notification = await createAdminNotification(
      { title, body, targetAudience, deliveryType, scheduledFor, deepLink },
      req.user
    );

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single notification (admin)
 * @route   GET /api/admin/notifications/:id
 * @access  Private/Admin
 */
exports.getNotification = async (req, res, next) => {
  try {
    const notification = await PushNotification.findById(req.params.id).populate('sentBy', 'firstName lastName email');

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete notification (admin)
 * @route   DELETE /api/admin/notifications/:id
 * @access  Private/Admin
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await PushNotification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's notifications (app – manual + booking_created + booking_updated)
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notifications = await PushNotification.find({
      status: 'sent',
      recipientUserIds: userId
    })
      .select('type title body sentAt createdAt deepLink deliveryStatus')
      .sort({ sentAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};
