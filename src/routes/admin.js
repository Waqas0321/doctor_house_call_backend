const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  getBookingDetails,
  updateBookingStatus,
  overrideBooking,
  getLocationHeatmap,
  getAllZones,
  createZone,
  updateZone,
  deleteZone,
  testZoneMatching,
  getAuditLogs
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Booking routes
router.get('/bookings', getAllBookings);
router.get('/bookings/heatmap', getLocationHeatmap);
router.get('/bookings/:id', getBookingDetails);
router.put('/bookings/:id/status', updateBookingStatus);
router.put('/bookings/:id/override', overrideBooking);

// Zone routes
router.get('/zones', getAllZones);
router.post('/zones', createZone);
router.post('/zones/test', testZoneMatching);
router.put('/zones/:id', updateZone);
router.delete('/zones/:id', deleteZone);

// Audit log routes
router.get('/audit-logs', getAuditLogs);

module.exports = router;
