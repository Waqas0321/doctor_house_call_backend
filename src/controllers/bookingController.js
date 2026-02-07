const Booking = require('../models/Booking');
const FamilyMember = require('../models/FamilyMember');
const { normalizeAndGeocode, reverseGeocode } = require('../services/addressService');
const { findMatchingZone, getAvailableVisitTypes } = require('../services/zoneService');
const { sendConfirmation } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditService');

/**
 * @desc    Create a new booking (App flow: select patient → visit details → service area → book)
 * @route   POST /api/bookings
 * @access  Private (auth required for app)
 */
exports.createBooking = async (req, res, next) => {
  try {
    const {
      familyMemberId,
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

    // Validate required fields - App flow
    if (!familyMemberId) {
      return res.status(400).json({
        success: false,
        error: 'Please select a patient'
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

    // Location: either lat/lng (from "get current location") or address
    let addressData;
    if (lat != null && lng != null) {
      addressData = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    } else if (address) {
      addressData = await normalizeAndGeocode(address);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Location is required. Provide lat/lng (from current location) or address'
      });
    }

    // Safety acknowledgements - optional for app, default to accepted
    const safety = safetyAcknowledgements || {};
    const safetyAck = {
      notForEmergencies: safety.notForEmergencies !== false,
      call911Acknowledged: safety.call911Acknowledged !== false
    };

    // Testing phase: accept bookings worldwide (no zone restriction for phone or house call)
    const zone = null; // await findMatchingZone(addressData.lat, addressData.lng);
    // When live: const availableTypes = getAvailableVisitTypes(zone); then reject if house_call && !availableTypes.houseCall

    // Get patient info from selected family member
    const familyMember = await FamilyMember.findOne({
      _id: familyMemberId,
      userId: req.user?.id,
      isActive: true
    });

    if (!familyMember) {
      return res.status(400).json({
        success: false,
        error: 'Patient not found. Please select a valid patient.'
      });
    }

    const finalPatientInfo = {
      firstName: familyMember.firstName,
      lastName: familyMember.lastName,
      dob: familyMember.dob,
      phin: familyMember.phin,
      mhsc: familyMember.mhsc
    };

    // Create booking
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
      familyMemberId,
      contactPhone,
      contactEmail,
      confirmationMethod: 'email',
      notes,
      userId: req.user?.id || null,
      safetyAcknowledgements: safetyAck
    });

    // Send confirmation
    await sendConfirmation(booking);

    // Create audit log
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
      .populate('familyMemberId', 'firstName lastName dob');

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
      .populate('userId', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if user owns booking or is admin
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
