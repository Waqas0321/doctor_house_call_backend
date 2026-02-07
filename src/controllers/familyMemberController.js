const FamilyMember = require('../models/FamilyMember');
const { createAuditLog } = require('../services/auditService');

/**
 * @desc    Get all family members for user
 * @route   GET /api/family-members
 * @access  Private
 */
exports.getFamilyMembers = async (req, res, next) => {
  try {
    const familyMembers = await FamilyMember.find({
      userId: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: familyMembers.length,
      data: familyMembers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single family member
 * @route   GET /api/family-members/:id
 * @access  Private
 */
exports.getFamilyMember = async (req, res, next) => {
  try {
    const familyMember = await FamilyMember.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        error: 'Family member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: familyMember
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create family member
 * @route   POST /api/family-members
 * @access  Private
 */
exports.createFamilyMember = async (req, res, next) => {
  try {
    const { firstName, lastName, name, dob, image, address, phin, mhsc, notes } = req.body;

    // Support both "name" (split) and "firstName/lastName"
    let finalFirstName = firstName;
    let finalLastName = lastName;
    if (name && !firstName && !lastName) {
      const nameParts = name.trim().split(/\s+/);
      finalFirstName = nameParts[0] || '';
      finalLastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
    }

    if (!finalFirstName || !finalLastName || !dob) {
      return res.status(400).json({
        success: false,
        error: 'Name and date of birth are required'
      });
    }

    const familyMember = await FamilyMember.create({
      userId: req.user.id,
      firstName: finalFirstName,
      lastName: finalLastName,
      dob: new Date(dob),
      image,
      address,
      phin,
      mhsc,
      notes
    });

    await createAuditLog({
      action: 'family_member_added',
      userId: req.user.id,
      entityType: 'family_member',
      entityId: familyMember._id,
      changes: { familyMember },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      data: familyMember
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update family member
 * @route   PUT /api/family-members/:id
 * @access  Private
 */
exports.updateFamilyMember = async (req, res, next) => {
  try {
    const { firstName, lastName, name, dob, image, address, phin, mhsc, notes } = req.body;

    const familyMember = await FamilyMember.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        error: 'Family member not found'
      });
    }

    const oldData = { ...familyMember.toObject() };

    if (name) {
      const nameParts = name.trim().split(/\s+/);
      familyMember.firstName = nameParts[0] || familyMember.firstName;
      familyMember.lastName = nameParts.slice(1).join(' ') || nameParts[0] || familyMember.lastName;
    }
    if (firstName) familyMember.firstName = firstName;
    if (lastName) familyMember.lastName = lastName;
    if (dob) familyMember.dob = new Date(dob);
    if (image !== undefined) familyMember.image = image;
    if (address !== undefined) familyMember.address = address;
    if (phin !== undefined) familyMember.phin = phin;
    if (mhsc !== undefined) familyMember.mhsc = mhsc;
    if (notes !== undefined) familyMember.notes = notes;

    await familyMember.save();

    await createAuditLog({
      action: 'family_member_updated',
      userId: req.user.id,
      entityType: 'family_member',
      entityId: familyMember._id,
      changes: { old: oldData, new: familyMember.toObject() },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      data: familyMember
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete family member (soft delete)
 * @route   DELETE /api/family-members/:id
 * @access  Private
 */
exports.deleteFamilyMember = async (req, res, next) => {
  try {
    const familyMember = await FamilyMember.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        error: 'Family member not found'
      });
    }

    familyMember.isActive = false;
    await familyMember.save();

    await createAuditLog({
      action: 'family_member_deleted',
      userId: req.user.id,
      entityType: 'family_member',
      entityId: familyMember._id,
      changes: { deleted: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'Family member deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
