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

/**
 * @desc    Get Heatmap & Analytics – overview, zone heatmap, booking trends (auto-detected)
 * @route   GET /api/dashboard/analytics
 * @access  Private/Admin
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = '7days' } = req.query;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    let startDate;
    switch (period) {
      case '30days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate = new Date(startOfWeek);
    }

    // 1. Overview metrics
    const totalBookings = await Booking.countDocuments();
    const activeZones = await Zone.countDocuments({ isActive: true });
    const totalZones = await Zone.countDocuments();

    // Avg response time: time from booking_created to first admin action (booking_confirmed/updated)
    let avgResponseTimeMinutes = null;
    try {
      const createdLogs = await AuditLog.find({
        action: 'booking_created',
        entityType: 'booking'
      })
        .select('entityId createdAt')
        .lean();

      const responseTimes = [];
      for (const log of createdLogs.slice(0, 100)) {
        const firstAdmin = await AuditLog.findOne({
          entityType: 'booking',
          entityId: log.entityId,
          adminId: { $exists: true, $ne: null },
          createdAt: { $gt: log.createdAt }
        })
          .sort({ createdAt: 1 })
          .select('createdAt')
          .lean();
        if (firstAdmin) {
          const ms = new Date(firstAdmin.createdAt) - new Date(log.createdAt);
          responseTimes.push(ms / 60000);
        }
      }
      if (responseTimes.length > 0) {
        avgResponseTimeMinutes = Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10;
      }
    } catch (e) {
      // ignore
    }

    // Customer satisfaction: completion rate (completed / total) as proxy when no rating system
    const statusCounts = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byStatus = statusCounts.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});
    const completed = byStatus.completed || 0;
    const customerSatisfaction = totalBookings > 0
      ? Math.round((completed / totalBookings) * 100)
      : null;

    const overview = {
      totalBookings,
      activeZones: activeZones || totalZones,
      avgResponseTimeMinutes: avgResponseTimeMinutes ?? null,
      customerSatisfaction: customerSatisfaction ?? null
    };

    // 2. Service Zone Heatmap – all zones with booking counts and activity level
    const zoneCounts = await Booking.aggregate([
      { $match: { createdAt: { $gte: startDate }, zoneId: { $ne: null } } },
      { $group: { _id: '$zoneId', count: { $sum: 1 } } }
    ]);
    const countByZone = zoneCounts.reduce((acc, z) => { acc[z._id?.toString()] = z.count; return acc; }, {});

    const zones = await Zone.find({ isActive: true }).select('name').lean();
    const allCounts = zones.map((z) => countByZone[z._id.toString()] || 0);
    const maxCount = Math.max(...allCounts, 1);
    const highThreshold = maxCount * 0.67;
    const medThreshold = maxCount * 0.33;

    const zoneHeatmap = zones.map((z) => {
      const count = countByZone[z._id.toString()] || 0;
      return {
        zoneId: z._id,
        zoneName: z.name,
        count,
        activityLevel: count >= highThreshold ? 'high' : count >= medThreshold ? 'medium' : 'low'
      };
    }).sort((a, b) => b.count - a.count);

    // Include "Unknown" zone for bookings with no zone
    const unknownCount = await Booking.countDocuments({
      createdAt: { $gte: startDate },
      $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
    });
    if (unknownCount > 0) {
      zoneHeatmap.push({
        zoneId: null,
        zoneName: 'Unknown / No Zone',
        count: unknownCount,
        activityLevel: unknownCount >= highThreshold ? 'high' : unknownCount >= medThreshold ? 'medium' : 'low'
      });
    }

    // 3. Booking Trends – last 7 days by weekday (Mon–Sun)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekStart = new Date(startOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const trendsByDate = await Booking.aggregate([
      { $match: { createdAt: { $gte: weekStart, $lte: now } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const trendsMap = trendsByDate.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});
    const bookingTrends = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      bookingTrends.push({
        day: dayNames[d.getDay()],
        date: key,
        count: trendsMap[key] || 0
      });
    }

    // 4. Heatmap coordinates (for map)
    const heatmapData = await Booking.find(
      { createdAt: { $gte: startDate } },
      { 'location.lat': 1, 'location.lng': 1, visitType: 1, createdAt: 1 }
    )
      .lean();

    res.status(200).json({
      success: true,
      data: {
        overview,
        zoneHeatmap,
        bookingTrends,
        heatmapData: heatmapData.map((b) => ({
          lat: b.location?.lat,
          lng: b.location?.lng,
          visitType: b.visitType,
          createdAt: b.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
