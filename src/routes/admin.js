const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  createBooking,
  getBookingDetails,
  updateBookingStatus,
  overrideBooking,
  deleteBooking,
  getLocationHeatmap,
  getAllZones,
  createZone,
  updateZone,
  updateZoneActive,
  deleteZone,
  testZoneMatching,
  getAuditLogs,
  getAllUsers,
  getUser,
  getTokenForUser,
  getUserFamilyMembers,
  updateUser,
  deleteUser
} = require('../controllers/adminController');
const {
  getAllNotifications,
  createNotification,
  getNotification,
  deleteNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Booking routes
router.get('/bookings', getAllBookings);
router.post('/bookings', createBooking);
router.get('/bookings/heatmap', getLocationHeatmap);
router.get('/bookings/:id', getBookingDetails);
router.put('/bookings/:id/status', updateBookingStatus);
router.put('/bookings/:id/override', overrideBooking);
router.delete('/bookings/:id', deleteBooking);

// User management (admin full access)
router.get('/users', getAllUsers);
router.get('/users/:id/token', getTokenForUser);
router.get('/users/:id/family-members', getUserFamilyMembers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Zone routes
router.get('/zones', getAllZones);
router.post('/zones', createZone);
router.post('/zones/test', testZoneMatching);
router.put('/zones/:id', updateZone);
router.patch('/zones/:id/active', updateZoneActive);
router.delete('/zones/:id', deleteZone);

// Audit log routes
router.get('/audit-logs', getAuditLogs);

// Notification routes
router.get('/notifications', getAllNotifications);
router.post('/notifications', createNotification);
router.get('/notifications/:id', getNotification);
router.delete('/notifications/:id', deleteNotification);

module.exports = router;
