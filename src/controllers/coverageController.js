const Zone = require('../models/Zone');
const { normalizeAndGeocode, autocompleteAddress } = require('../services/addressService');
const { checkCoverage } = require('../services/zoneService');

/**
 * @desc    Address autocomplete suggestions (Google Places when key set, else OSM/Photon)
 * @route   GET /api/coverage/autocomplete?q=...
 * @access  Public
 */
exports.autocomplete = async (req, res, next) => {
  try {
    const q = (req.query.q || req.query.query || '').trim();
    if (q.length < 3) {
      return res.status(200).json({ success: true, data: [] });
    }

    const limit = req.query.limit;
    const data = await autocompleteAddress(q, limit);

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List active service zones (for app to show "We serve: ...")
 * @route   GET /api/coverage/zones
 * @access  Public
 */
exports.getActiveZones = async (req, res, next) => {
  try {
    const zones = await Zone.find({ isActive: true })
      .select('name allowPhoneCall allowHouseCall priority')
      .sort({ priority: -1 })
      .lean();

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
 * @desc    Check service coverage for an address or lat/lng
 * @route   POST /api/coverage/check
 * @access  Public
 * @body    { address?: string } OR { lat: number, lng: number }
 */
exports.checkServiceCoverage = async (req, res, next) => {
  try {
    const { address, lat, lng } = req.body;

    let addressLabel;
    let latitude;
    let longitude;

    if (address) {
      const addressData = await normalizeAndGeocode(address);
      addressLabel = addressData.normalized;
      latitude = addressData.lat;
      longitude = addressData.lng;
    } else if (lat != null && lng != null) {
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
      addressLabel = `${latitude},${longitude}`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide address or lat and lng'
      });
    }

    const coverage = await checkCoverage(addressLabel, latitude, longitude);

    res.status(200).json({
      success: true,
      data: coverage
    });
  } catch (error) {
    next(error);
  }
};
