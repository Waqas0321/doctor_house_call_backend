const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  getAllNotifications,
  createNotification,
  getNotification,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// App: get current user's notifications
router.get('/', getUserNotifications);

// Admin: same as /api/admin/notifications (alternate path for compatibility)
router.get('/admin', authorize('admin'), getAllNotifications);
router.post('/admin', authorize('admin'), createNotification);
router.get('/admin/:id', authorize('admin'), getNotification);
router.delete('/admin/:id', authorize('admin'), deleteNotification);

module.exports = router;
