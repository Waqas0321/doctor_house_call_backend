const Booking = require('../models/Booking');
const Zone = require('../models/Zone');
const { normalizeAndGeocode } = require('../services/addressService');
const { findMatchingZone, getAvailableVisitTypes } = require('../services/zoneService');
const { logBookingOverride } = require('../services/auditService');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all bookings (admin)
 * @route   GET /api/admin/bookings
 * @access  Private/Admin
 */
exports.getAllBookings = async (req, res, next) => {
  try {
    const { status, zoneId, visitType, startDate, endDate } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (zoneId) filter.zoneId = zoneId;
    if (visitType) filter.visitType = visitType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(filter)
      .populate('zoneId', 'name')
      .populate('userId', 'firstName lastName email phone')
      .populate('familyMemberId', 'firstName lastName dob')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get booking details (admin)
 * @route   GET /api/admin/bookings/:id
 * @access  Private/Admin
 */
exports.getBookingDetails = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('zoneId')
      .populate('userId')
      .populate('familyMemberId')
      .populate('assignedProvider.providerId', 'firstName lastName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update booking status
 * @route   PUT /api/admin/bookings/:id/status
 * @access  Private/Admin
 */
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, assignedProvider, scheduledTime, reason } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const oldStatus = booking.status;

    if (status) {
      if (!['new', 'needs_review', 'confirmed', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }
      booking.status = status;
    }

    if (assignedProvider) {
      booking.assignedProvider = assignedProvider;
    }

    if (scheduledTime) {
      booking.scheduledTime = new Date(scheduledTime);
    }

    await booking.save();

    await AuditLog.create({
      action: status === 'confirmed' ? 'booking_confirmed' : 'booking_updated',
      adminId: req.user.id,
      entityType: 'booking',
      entityId: booking._id,
      changes: { oldStatus, newStatus: booking.status },
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Override booking zone/visit type
 * @route   PUT /api/admin/bookings/:id/override
 * @access  Private/Admin
 */
exports.overrideBooking = async (req, res, next) => {
  try {
    const { overrideZoneId, allowedVisitTypes, reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required for override'
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const originalZoneId = booking.zoneId;

    booking.override = {
      isOverridden: true,
      originalZoneId,
      overrideZoneId: overrideZoneId || booking.zoneId,
      allowedVisitTypes: allowedVisitTypes || {
        phoneCall: true,
        houseCall: true
      },
      reason,
      overriddenBy: req.user.id,
      overriddenAt: new Date()
    };

    if (overrideZoneId) {
      booking.zoneId = overrideZoneId;
      const zone = await Zone.findById(overrideZoneId);
      if (zone) booking.matchedZoneName = zone.name;
    }

    await booking.save();

    await logBookingOverride(booking, req.user, booking.override, reason, req);

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get location heatmap data
 * @route   GET /api/admin/bookings/heatmap
 * @access  Private/Admin
 */
exports.getLocationHeatmap = async (req, res, next) => {
  try {
    const { startDate, endDate, visitType } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (visitType) filter.visitType = visitType;

    const bookings = await Booking.find(filter, {
      'location.lat': 1,
      'location.lng': 1,
      visitType: 1,
      createdAt: 1
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Test zone matching
 * @route   POST /api/admin/zones/test
 * @access  Private/Admin
 */
exports.testZoneMatching = async (req, res, next) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    const addressData = await normalizeAndGeocode(address);
    const zone = await findMatchingZone(addressData.lat, addressData.lng);
    const availableTypes = getAvailableVisitTypes(zone);

    res.status(200).json({
      success: true,
      data: {
        address: addressData,
        zone: zone ? {
          id: zone._id,
          name: zone.name,
          allowPhoneCall: zone.allowPhoneCall,
          allowHouseCall: zone.allowHouseCall,
          phoneCallsFull: zone.phoneCallsFull,
          houseCallsFull: zone.houseCallsFull
        } : null,
        availableTypes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all zones
 * @route   GET /api/admin/zones
 * @access  Private/Admin
 */
exports.getAllZones = async (req, res, next) => {
  try {
    const zones = await Zone.find().sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: zones.length,
      data: zones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create zone
 * @route   POST /api/admin/zones
 * @access  Private/Admin
 */
exports.createZone = async (req, res, next) => {
  try {
    const {
      name,
      boundaryData,
      allowPhoneCall,
      allowHouseCall,
      priority,
      isActive
    } = req.body;

    if (!name || !boundaryData) {
      return res.status(400).json({
        success: false,
        error: 'Name and boundary data are required'
      });
    }

    const zone = await Zone.create({
      name,
      boundaryData,
      allowPhoneCall: allowPhoneCall !== undefined ? allowPhoneCall : true,
      allowHouseCall: allowHouseCall !== undefined ? allowHouseCall : true,
      priority: priority || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await AuditLog.create({
      action: 'zone_created',
      adminId: req.user.id,
      entityType: 'zone',
      entityId: zone._id,
      changes: { zone },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      data: zone
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update zone
 * @route   PUT /api/admin/zones/:id
 * @access  Private/Admin
 */
exports.updateZone = async (req, res, next) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    const oldData = { ...zone.toObject() };

    const {
      name,
      boundaryData,
      allowPhoneCall,
      allowHouseCall,
      phoneCallsFull,
      houseCallsFull,
      priority,
      isActive
    } = req.body;

    if (name) zone.name = name;
    if (boundaryData) zone.boundaryData = boundaryData;
    if (allowPhoneCall !== undefined) zone.allowPhoneCall = allowPhoneCall;
    if (allowHouseCall !== undefined) zone.allowHouseCall = allowHouseCall;
    if (phoneCallsFull !== undefined) zone.phoneCallsFull = phoneCallsFull;
    if (houseCallsFull !== undefined) zone.houseCallsFull = houseCallsFull;
    if (priority !== undefined) zone.priority = priority;
    if (isActive !== undefined) zone.isActive = isActive;

    await zone.save();

    await AuditLog.create({
      action: 'zone_updated',
      adminId: req.user.id,
      entityType: 'zone',
      entityId: zone._id,
      changes: { old: oldData, new: zone.toObject() },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      data: zone
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete zone
 * @route   DELETE /api/admin/zones/:id
 * @access  Private/Admin
 */
exports.deleteZone = async (req, res, next) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    await zone.deleteOne();

    await AuditLog.create({
      action: 'zone_deleted',
      adminId: req.user.id,
      entityType: 'zone',
      entityId: zone._id,
      changes: { deleted: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get audit logs
 * @route   GET /api/admin/audit-logs
 * @access  Private/Admin
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, entityId, startDate, endDate } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('adminId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(1000);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};
