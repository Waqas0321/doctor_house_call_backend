const Zone = require('../models/Zone');
const pip = require('point-in-polygon');

/**
 * Check if a point is inside a polygon
 * GeoJSON: coordinates are [lng, lat], polygon ring is array of [lng, lat]
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} polygonCoordinates - GeoJSON coordinates (Polygon: [[ring]], ring = [[lng,lat],...])
 * @returns {boolean} True if point is inside polygon
 */
const pointInPolygon = (lat, lng, polygonCoordinates) => {
  try {
    const point = [lng, lat];
    const ring = polygonCoordinates[0] && Array.isArray(polygonCoordinates[0][0])
      ? polygonCoordinates[0]
      : polygonCoordinates;
    return pip(point, ring);
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
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      return null;
    }

    const zones = await Zone.find({ isActive: true })
      .sort({ priority: -1 });

    for (const zone of zones) {
      const bd = zone?.boundaryData;
      if (!bd?.coordinates || !bd?.type) {
        continue;
      }

      try {
        const { coordinates, type } = bd;
        if (type === 'Polygon') {
          if (pointInPolygon(la, ln, coordinates)) {
            return zone;
          }
        } else if (type === 'MultiPolygon') {
          for (const polygon of coordinates) {
            if (pointInPolygon(la, ln, polygon)) {
              return zone;
            }
          }
        }
      } catch (e) {
        console.warn(
          'findMatchingZone: skipping zone',
          zone._id?.toString(),
          e.message
        );
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding matching zone:', error);
    return null;
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
