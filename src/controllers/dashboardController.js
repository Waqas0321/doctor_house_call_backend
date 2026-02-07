const Booking = require('../models/Booking');
const User = require('../models/User');
const Zone = require('../models/Zone');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Private/Admin
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Total bookings
    const totalBookings = await Booking.countDocuments();
    
    // Today's bookings
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: today }
    });

    // This week's bookings
    const weekBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfWeek }
    });

    // This month's bookings
    const monthBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Bookings by status
    const bookingsByStatus = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bookings by visit type
    const bookingsByVisitType = await Booking.aggregate([
      {
        $group: {
          _id: '$visitType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent bookings (last 10)
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName email')
      .populate('zoneId', 'name')
      .select('visitType status createdAt patientInfo address');

    // Total users
    const totalUsers = await User.countDocuments({ isAdmin: false });
    
    // Total zones
    const totalZones = await Zone.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBookings,
          todayBookings,
          weekBookings,
          monthBookings,
          totalUsers,
          totalZones
        },
        bookingsByStatus: bookingsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bookingsByVisitType: bookingsByVisitType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentBookings
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard chart data
 * @route   GET /api/dashboard/charts
 * @access  Private/Admin
 */
exports.getDashboardCharts = async (req, res, next) => {
  try {
    const { period = '7days' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
    }

    // Bookings over time
    const bookingsOverTime = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Bookings by zone
    const bookingsByZone = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$zoneId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'zones',
          localField: '_id',
          foreignField: '_id',
          as: 'zone'
        }
      },
      {
        $unwind: { path: '$zone', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          zoneName: { $ifNull: ['$zone.name', 'Unknown'] },
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookingsOverTime,
        bookingsByZone
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get recent activity
 * @route   GET /api/dashboard/activity
 * @access  Private/Admin
 */
exports.getRecentActivity = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const activities = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'firstName lastName email')
      .populate('adminId', 'firstName lastName email')
      .select('action entityType entityId createdAt changes');

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};
