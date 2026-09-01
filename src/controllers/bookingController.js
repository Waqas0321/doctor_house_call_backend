const Booking = require('../models/Booking');
const FamilyMember = require('../models/FamilyMember');
const { normalizeAndGeocode, reverseGeocode } = require('../services/addressService');
const { findMatchingZone, getAvailableVisitTypes } = require('../services/zoneService');
const { sendConfirmation } = require('../services/notificationService');
const { notifyAdminsBookingCreated } = require('../services/pushNotificationService');
const { createAuditLog } = require('../services/auditService');

const buildPatientSnapshot = (familyMember) => {
  const fullName =
    familyMember.fullName ||
    [familyMember.firstName, familyMember.lastName].filter(Boolean).join(' ').trim();
  const nameParts = (fullName || 'Patient').split(/\s+/);
  return {
    firstName: nameParts[0] || familyMember.firstName || '',
    lastName: nameParts.slice(1).join(' ') || familyMember.lastName || '',
    dob: familyMember.dob,
    phin: familyMember.phin,
    mhsc: familyMember.mhsc,
    familyMemberId: familyMember._id
  };
};

/**
 * @desc    Create a new booking (App flow: select patient → visit details → service area → book)
 * @route   POST /api/bookings
 * @access  Private (auth required for app)
 */
exports.createBooking = async (req, res, next) => {
  try {
    const {
      familyMemberId,
      familyMemberIds,
      contactPhone,
      contactEmail,
      notes,
      visitType,
      lat,
      lng,
      address,
      unitBuzzer,
      accessInstructions,
      safetyAcknowledgements
    } = req.body;

    const memberIds = Array.isArray(familyMemberIds) && familyMemberIds.length > 0
      ? [...new Set(familyMemberIds.map(String))]
      : familyMemberId
        ? [String(familyMemberId)]
        : [];

    if (memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one patient'
      });
    }

    if (!contactPhone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!contactEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    if (!visitType || !['phone_call', 'house_call'].includes(visitType)) {
      return res.status(400).json({
        success: false,
        error: 'Please select visit type: phone_call or house_call'
      });
    }

    // Prefer explicit address (patient address) over device GPS for zone accuracy
    let addressData;
    if (address && String(address).trim()) {
      addressData = await normalizeAndGeocode(String(address).trim());
    } else if (lat != null && lng != null) {
      addressData = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    } else {
      return res.status(400).json({
        success: false,
        error: 'Location is required. Provide address or lat/lng'
      });
    }

    // Enforce service zones
    const zone = await findMatchingZone(addressData.lat, addressData.lng);
    const availableTypes = getAvailableVisitTypes(zone);

    if (visitType === 'phone_call' && !availableTypes.phoneCall) {
      return res.status(400).json({
        success: false,
        error: availableTypes.message || 'Phone calls are not available at this location'
      });
    }
    if (visitType === 'house_call' && !availableTypes.houseCall) {
      return res.status(400).json({
        success: false,
        error: availableTypes.message || 'House calls are not available at this location'
      });
    }

    const safety = safetyAcknowledgements || {};
    const safetyAck = {
      notForEmergencies: safety.notForEmergencies !== false,
      call911Acknowledged: safety.call911Acknowledged !== false
    };

    const familyMembers = await FamilyMember.find({
      _id: { $in: memberIds },
      userId: req.user?.id,
      isActive: true
    });

    if (familyMembers.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more patients were not found. Please select valid patients.'
      });
    }

    // Preserve selection order
    const orderedMembers = memberIds
      .map((id) => familyMembers.find((m) => m._id.toString() === id))
      .filter(Boolean);

    const patientsInfo = orderedMembers.map(buildPatientSnapshot);
    const primary = patientsInfo[0];
    const finalPatientInfo = {
      firstName: primary.firstName,
      lastName: primary.lastName,
      dob: primary.dob,
      phin: primary.phin,
      mhsc: primary.mhsc
    };

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
      location: {
        lat: addressData.lat,
        lng: addressData.lng
      },
      unitBuzzer,
      accessInstructions,
      zoneId: zone?._id,
      matchedZoneName: zone?.name,
      patientInfo: finalPatientInfo,
      patientsInfo,
      familyMemberId: orderedMembers[0]._id,
      familyMemberIds: orderedMembers.map((m) => m._id),
      contactPhone,
      contactEmail,
      confirmationMethod: 'email',
      notes,
      userId: req.user?.id || null,
      safetyAcknowledgements: safetyAck
    });

    await sendConfirmation(booking);
    notifyAdminsBookingCreated(booking).catch((e) =>
      console.error('Push to admins:', e.message)
    );

    await createAuditLog({
      action: 'booking_created',
      userId: req.user?.id,
      entityType: 'booking',
      entityId: booking._id,
      changes: { booking },
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
 * @desc    Get user's bookings
 * @route   GET /api/bookings
 * @access  Private
 */
exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('zoneId', 'name')
      .populate('familyMemberId', 'firstName lastName dob')
      .populate('familyMemberIds', 'firstName lastName fullName dob');

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
 * @desc    Get single booking
 * @route   GET /api/bookings/:id
 * @access  Private
 */
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('zoneId')
      .populate('familyMemberId')
      .populate('familyMemberIds')
      .populate('userId', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId?.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this booking'
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
