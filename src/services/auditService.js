const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry
 * @param {Object} logData - Audit log data
 * @returns {Promise<Object>} Created audit log
 */
exports.createAuditLog = async (logData) => {
  try {
    const auditLog = await AuditLog.create({
      action: logData.action,
      userId: logData.userId,
      adminId: logData.adminId,
      entityType: logData.entityType,
      entityId: logData.entityId,
      changes: logData.changes,
      reason: logData.reason,
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent
    });

    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging shouldn't break the main flow
    return null;
  }
};

/**
 * Log booking override
 * @param {Object} booking - Booking object
 * @param {Object} adminUser - Admin user
 * @param {Object} overrideData - Override data
 * @param {string} reason - Reason for override
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
exports.logBookingOverride = async (booking, adminUser, overrideData, reason, req) => {
  await exports.createAuditLog({
    action: 'booking_overridden',
    adminId: adminUser._id,
    entityType: 'booking',
    entityId: booking._id,
    changes: {
      original: {
        zoneId: booking.zoneId,
        visitType: booking.visitType
      },
      override: overrideData
    },
    reason,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
};
