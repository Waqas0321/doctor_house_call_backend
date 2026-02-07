const { normalizeAndGeocode } = require('../services/addressService');
const { checkCoverage } = require('../services/zoneService');

/**
 * @desc    Check service coverage for an address
 * @route   POST /api/coverage/check
 * @access  Public
 */
exports.checkServiceCoverage = async (req, res, next) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    // Normalize and geocode address
    const addressData = await normalizeAndGeocode(address);

    // Check coverage
    const coverage = await checkCoverage(
      addressData.normalized,
      addressData.lat,
      addressData.lng
    );

    res.status(200).json({
      success: true,
      data: coverage
    });
  } catch (error) {
    next(error);
  }
};
