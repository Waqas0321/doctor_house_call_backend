const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getDashboardCharts,
  getRecentActivity
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

// All dashboard routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

// Dashboard endpoints
router.get('/stats', getDashboardStats);
router.get('/charts', getDashboardCharts);
router.get('/activity', getRecentActivity);

module.exports = router;
