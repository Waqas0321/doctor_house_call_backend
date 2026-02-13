const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const Zone = require('../models/Zone');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const { normalizeAndGeocode, reverseGeocode } = require('../services/addressService');
const { findMatchingZone, getAvailableVisitTypes } = require('../services/zoneService');
const { logBookingOverride, createAuditLog } = require('../services/auditService');
const { sendConfirmation } = require('../services/notificationService');
const { notifyUserBookingUpdated, notifyUserBookingCreatedByAdmin } = require('../services/pushNotificationService');
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
      .populate('userId', 'firstName lastName email phone isAdmin')
      .populate('familyMemberId', 'fullName firstName lastName dob')
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
 * @desc    Create booking on behalf of a user (manual booking from admin panel)
 * @route   POST /api/admin/bookings
 * @access  Private/Admin
 */
exports.createBooking = async (req, res, next) => {
  try {
    const {
      userId,
      familyMemberId,
      contactPhone,
      contactEmail,
      notes,
      visitType,
      lat,
      lng,
      address,
      unitBuzzer,
      accessInstructions
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (!familyMemberId) {
      return res.status(400).json({ success: false, error: 'familyMemberId (patient) is required' });
    }
    if (!contactPhone) {
      return res.status(400).json({ success: false, error: 'Contact phone is required' });
    }
    if (!contactEmail) {
      return res.status(400).json({ success: false, error: 'Contact email is required' });
    }
    if (!visitType || !['phone_call', 'house_call'].includes(visitType)) {
      return res.status(400).json({ success: false, error: 'visitType must be phone_call or house_call' });
    }

    let addressData;
    if (lat != null && lng != null) {
      addressData = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    } else if (address) {
      addressData = await normalizeAndGeocode(address);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Location required: provide lat/lng or address'
      });
    }

    const familyMember = await FamilyMember.findOne({
      _id: familyMemberId,
      userId,
      isActive: true
    });
    if (!familyMember) {
      return res.status(400).json({
        success: false,
        error: 'Patient not found or does not belong to this user'
      });
    }

    const fullName = familyMember.fullName || [familyMember.firstName, familyMember.lastName].filter(Boolean).join(' ').trim();
    const nameParts = (fullName || 'Patient').split(/\s+/);
    const patientInfo = {
      firstName: nameParts[0] || familyMember.firstName || '',
      lastName: nameParts.slice(1).join(' ') || familyMember.lastName || '',
      dob: familyMember.dob,
      phin: familyMember.phin,
      mhsc: familyMember.mhsc
    };

    const zone = await findMatchingZone(addressData.lat, addressData.lng);

    const booking = await Booking.create({
      visitType,
      address: {
        raw: address || addressData.raw,
        normalized: addressData.normalized,
        street: addressData.street,
        city: addressData.city,
        province: addressData.province,
        postalCode: addressData.postalCode,
        country: addressData.country
      },
      location: { lat: addressData.lat, lng: addressData.lng },
      unitBuzzer,
      accessInstructions,
      zoneId: zone?._id,
      matchedZoneName: zone?.name,
      patientInfo,
      familyMemberId,
      contactPhone,
      contactEmail,
      confirmationMethod: 'email',
      notes,
      userId,
      safetyAcknowledgements: { notForEmergencies: true, call911Acknowledged: true }
    });

    await sendConfirmation(booking);

    notifyUserBookingCreatedByAdmin(booking).catch((e) => console.error('Push to user:', e.message));

    await createAuditLog({
      action: 'booking_created_by_admin',
      userId: req.user.id,
      entityType: 'booking',
      entityId: booking._id,
      changes: { createdForUser: userId, booking },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      data: booking
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

    if (status && oldStatus !== status) {
      notifyUserBookingUpdated(booking, oldStatus, booking.status).catch((e) => console.error('Push to user:', e.message));
    }

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
 * @desc    Delete booking (admin)
 * @route   DELETE /api/admin/bookings/:id
 * @access  Private/Admin
 */
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    await booking.deleteOne();

    await AuditLog.create({
      action: 'booking_deleted',
      adminId: req.user.id,
      entityType: 'booking',
      entityId: booking._id,
      changes: { deleted: true, status: booking.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
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
      phoneCallsFull,
      houseCallsFull,
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
      phoneCallsFull: phoneCallsFull === true,
      houseCallsFull: houseCallsFull === true,
      priority: priority ?? 0,
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
 * @desc    Enable or disable zone (toggle isActive)
 * @route   PATCH /api/admin/zones/:id/active
 * @access  Private/Admin
 */
exports.updateZoneActive = async (req, res, next) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be true or false'
      });
    }

    const previous = zone.isActive;
    zone.isActive = isActive;
    await zone.save();

    await AuditLog.create({
      action: 'zone_updated',
      adminId: req.user.id,
      entityType: 'zone',
      entityId: zone._id,
      changes: { isActive: { from: previous, to: isActive } },
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

// --------------- Admin User Management (full access) ---------------

/**
 * @desc    Get all users (admin)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { isActive, isAdmin: filterAdmin } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (filterAdmin !== undefined) filter.isAdmin = filterAdmin === 'true';

    const users = await User.find(filter)
      .select('-password -devices')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user (admin)
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -devices');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a short-lived token for a user (admin only). Use this token to call
 *          GET /api/family-members (same as the app) to get that user's family members.
 * @route   GET /api/admin/users/:id/token
 * @access  Private/Admin
 */
exports.getTokenForUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('_id isActive');
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.status(200).json({
      success: true,
      data: { token }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get family members for a user (admin – for manual booking dropdown)
 * @route   GET /api/admin/users/:id/family-members
 * @access  Private/Admin
 * Same shape as app GET /api/family-members: _id, userId, fullName, dob, image, imageUrl, etc.
 */
exports.getUserFamilyMembers = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User id is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const familyMembers = await FamilyMember.find({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true
    })
      .sort({ createdAt: -1 })
      .lean();

    const data = familyMembers.map((m) => {
      const fullName = m.fullName || [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || '—';
      return {
        _id: m._id.toString(),
        userId: m.userId?.toString(),
        fullName,
        firstName: m.firstName,
        lastName: m.lastName,
        dob: m.dob,
        image: m.image || null,
        imageUrl: m.image || null,
        address: m.address || null,
        isActive: m.isActive
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user (admin) – e.g. set isAdmin
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { isAdmin, isActive, firstName, lastName, email, phone, address } = req.body;
    if (isAdmin !== undefined) user.isAdmin = !!isAdmin;
    if (isActive !== undefined) user.isActive = !!isActive;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;

    await user.save();

    await AuditLog.create({
      action: 'user_updated_by_admin',
      adminId: req.user.id,
      entityType: 'user',
      entityId: user._id,
      changes: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete / deactivate user (admin)
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = false;
    user.email = user.email ? `deleted_${user._id}@deleted.local` : undefined;
    user.providerUserId = undefined;
    user.password = undefined;
    user.firstName = undefined;
    user.lastName = undefined;
    user.phone = undefined;
    user.address = undefined;
    user.profilePicture = undefined;
    user.devices = [];
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({
      action: 'user_deleted_by_admin',
      adminId: req.user.id,
      entityType: 'user',
      entityId: user._id,
      changes: { deleted: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};
