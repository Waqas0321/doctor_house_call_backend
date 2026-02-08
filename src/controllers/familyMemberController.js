const FamilyMember = require('../models/FamilyMember');
const { createAuditLog } = require('../services/auditService');
const { uploadImage } = require('../services/uploadService');

/** Base URL for building image URLs (e.g. https://api.example.com) */
const getBaseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const protocol = req.protocol || 'https';
  const host = req.get('host') || '';
  return host ? `${protocol}://${host}` : '';
};

/** Get fullName from doc (fullName or firstName + lastName for backward compat) */
const getFullName = (doc) => {
  if (doc.fullName && doc.fullName.trim()) return doc.fullName.trim();
  const first = (doc.firstName || '').trim();
  const last = (doc.lastName || '').trim();
  return [first, last].filter(Boolean).join(' ') || null;
};

/** Ensure each family member has fullName, image + imageUrl in the response */
const formatFamilyMemberResponse = (member, baseUrl) => {
  const doc = member.toObject ? member.toObject() : { ...member };
  const fullName = getFullName(doc);
  const image = doc.image ?? null;
  const imageUrl = (image && (image.startsWith('/') || image.startsWith('uploads/')))
    ? `${baseUrl}/${image.replace(/^\//, '')}`
    : image;
  const { firstName, lastName, ...rest } = doc;
  return { ...rest, fullName, image: image || null, imageUrl: imageUrl || null };
};

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
    })
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = getBaseUrl(req);
    const data = familyMembers.map((m) => formatFamilyMemberResponse(m, baseUrl));

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

    const baseUrl = getBaseUrl(req);
    const data = formatFamilyMemberResponse(familyMember, baseUrl);

    res.status(200).json({
      success: true,
      data
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
    const { fullName, dob, image, address, phin, mhsc, notes } = req.body;

    const trimmedFullName = (fullName || '').trim();
    if (!trimmedFullName || !dob) {
      return res.status(400).json({
        success: false,
        error: 'Full name and date of birth are required'
      });
    }

    const nameParts = trimmedFullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

    // Handle image: upload to Cloudinary (get URL) or fallback to base64
    let imageData = image || null;
    if (req.file && req.file.buffer) {
      const mimeType = req.file.mimetype || 'image/jpeg';
      const cloudinaryUrl = await uploadImage(req.file.buffer, mimeType);
      if (cloudinaryUrl) {
        imageData = cloudinaryUrl;
      } else {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
          console.warn('Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for image URLs.');
        }
        imageData = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    const familyMember = await FamilyMember.create({
      userId: req.user.id,
      fullName: trimmedFullName,
      firstName,
      lastName,
      dob: new Date(dob),
      image: imageData,
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

    const baseUrl = getBaseUrl(req);
    res.status(201).json({
      success: true,
      data: formatFamilyMemberResponse(familyMember, baseUrl)
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
    const { fullName, dob, image, address, phin, mhsc, notes } = req.body;

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

    if (fullName !== undefined && fullName !== null) {
      const trimmedFullName = String(fullName).trim();
      familyMember.fullName = trimmedFullName;
      const nameParts = trimmedFullName.split(/\s+/);
      familyMember.firstName = nameParts[0] || '';
      familyMember.lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
    }
    if (dob) familyMember.dob = new Date(dob);

    if (req.file && req.file.buffer) {
      const mimeType = req.file.mimetype || 'image/jpeg';
      const cloudinaryUrl = await uploadImage(req.file.buffer, mimeType);
      familyMember.image = cloudinaryUrl || `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
      if (!cloudinaryUrl && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY)) {
        console.warn('Cloudinary not configured. Set CLOUDINARY_* env vars for image URLs.');
      }
    } else if (image !== undefined) {
      familyMember.image = image;
    }
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

    const baseUrl = getBaseUrl(req);
    res.status(200).json({
      success: true,
      data: formatFamilyMemberResponse(familyMember, baseUrl)
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
