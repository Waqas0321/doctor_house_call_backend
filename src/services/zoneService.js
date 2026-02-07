const Zone = require('../models/Zone');
const turf = require('@turf/turf');

/**
 * Check if a point is inside a polygon
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} polygonCoordinates - Polygon coordinates array
 * @returns {boolean} True if point is inside polygon
 */
const pointInPolygon = (lat, lng, polygonCoordinates) => {
  try {
    const point = turf.point([lng, lat]);
    const polygon = turf.polygon(polygonCoordinates);
    return turf.booleanPointInPolygon(point, polygon);
  } catch (error) {
    console.error('Error checking point in polygon:', error);
    return false;
  }
};

/**
 * Find matching zone for a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Matched zone or null
 */
exports.findMatchingZone = async (lat, lng) => {
  try {
    // Get all active zones, sorted by priority (highest first)
    const zones = await Zone.find({ isActive: true })
      .sort({ priority: -1 });

    // Check each zone to see if point is inside
    for (const zone of zones) {
      const coordinates = zone.boundaryData.coordinates;
      
      // Handle both Polygon and MultiPolygon
      if (zone.boundaryData.type === 'Polygon') {
        if (pointInPolygon(lat, lng, coordinates)) {
          return zone;
        }
      } else if (zone.boundaryData.type === 'MultiPolygon') {
        // Check each polygon in the multipolygon
        for (const polygon of coordinates) {
          if (pointInPolygon(lat, lng, polygon)) {
            return zone;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding matching zone:', error);
    throw new Error(`Zone matching failed: ${error.message}`);
  }
};

/**
 * Get available visit types for a zone
 * @param {Object} zone - Zone object
 * @returns {Object} Available visit types
 */
exports.getAvailableVisitTypes = (zone) => {
  if (!zone) {
    return {
      phoneCall: false,
      houseCall: false,
      message: "Sorry — we don't currently serve this location."
    };
  }

  const phoneCallAvailable = zone.allowPhoneCall && !zone.phoneCallsFull;
  const houseCallAvailable = zone.allowHouseCall && !zone.houseCallsFull;

  let message = '';
  if (phoneCallAvailable && houseCallAvailable) {
    message = "Good news — we offer both phone and in-home visits in your area.";
  } else if (phoneCallAvailable) {
    message = "We currently offer phone appointments in your area.";
  } else if (houseCallAvailable) {
    message = "In-home doctor visits are available in your area.";
  } else {
    message = "Sorry — we don't currently serve this location.";
  }

  return {
    phoneCall: phoneCallAvailable,
    houseCall: houseCallAvailable,
    message,
    zoneName: zone.name
  };
};

/**
 * Check coverage for an address
 * @param {string} address - Address string
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Coverage information
 */
exports.checkCoverage = async (address, lat, lng) => {
  const zone = await exports.findMatchingZone(lat, lng);
  const availableTypes = exports.getAvailableVisitTypes(zone);

  return {
    address,
    lat,
    lng,
    zone: zone ? {
      id: zone._id,
      name: zone.name
    } : null,
    availableTypes,
    isInServiceArea: availableTypes.phoneCall || availableTypes.houseCall
  };
};
