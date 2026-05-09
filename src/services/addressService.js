const NodeGeocoder = require('node-geocoder');
const geocoder = require('../config/geocoder');

function mapGeocodeResult(result, rawAddress) {
  return {
    raw: rawAddress,
    normalized: result.formattedAddress,
    street: result.streetName ? `${result.streetNumber || ''} ${result.streetName}`.trim() : '',
    city: result.city || '',
    province: result.administrativeLevels?.level1short || result.state || '',
    postalCode: result.zipcode || '',
    country: result.country || 'Canada',
    lat: result.latitude,
    lng: result.longitude,
  };
}

function openStreetMapGeocoder() {
  const osmServer = (process.env.OSM_SERVER || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  return NodeGeocoder({
    provider: 'openstreetmap',
    formatter: null,
    osmServer,
  });
}

/**
 * Normalize and geocode an address
 * @param {string} address - Raw address string
 * @returns {Promise<Object>} Normalized address with coordinates
 */
exports.normalizeAndGeocode = async (address) => {
  const runGeocode = async (gc) => {
    const results = await gc.geocode(address);
    if (!results || results.length === 0) {
      throw new Error('Address could not be geocoded');
    }
    return mapGeocodeResult(results[0], address);
  };

  try {
    return await runGeocode(geocoder);
  } catch (primaryErr) {
    const msg = primaryErr.message || String(primaryErr);
    // Always try OSM if the primary provider failed (bad Google key, quota, network, etc.)
    try {
      return await runGeocode(openStreetMapGeocoder());
    } catch (e2) {
      const fallbackMsg = e2.message || String(e2);
      throw new Error(
        `Geocoding failed: ${fallbackMsg}${msg !== fallbackMsg ? ` (after: ${msg})` : ''}`
      );
    }
  }
};

/**
 * Reverse geocode coordinates to address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Address data with coordinates
 */
exports.reverseGeocode = async (lat, lng) => {
  try {
    const results = await geocoder.reverse({ lat, lon: lng });

    if (!results || results.length === 0) {
      return {
        raw: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        normalized: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        street: '',
        city: '',
        province: '',
        postalCode: '',
        country: 'Canada',
        lat,
        lng,
      };
    }

    const result = results[0];
    const formattedAddress = result.formattedAddress || `${result.city || ''} ${result.state || ''}`.trim() || `Location (${lat}, ${lng})`;

    return {
      raw: formattedAddress,
      normalized: formattedAddress,
      street: result.streetName ? `${result.streetNumber || ''} ${result.streetName}`.trim() : '',
      city: result.city || '',
      province: result.administrativeLevels?.level1short || result.state || '',
      postalCode: result.zipcode || '',
      country: result.country || 'Canada',
      lat,
      lng,
    };
  } catch (error) {
    const msg = error.message || String(error);
    if (/REQUEST_DENIED|OVER_QUERY_LIMIT|INVALID_REQUEST|API key|Geocoding failed: Status is/i.test(msg)) {
      try {
        const results = await openStreetMapGeocoder().reverse({ lat, lon: lng });
        if (!results || results.length === 0) {
          return {
            raw: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
            normalized: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
            street: '',
            city: '',
            province: '',
            postalCode: '',
            country: 'Canada',
            lat,
            lng,
          };
        }
        const result = results[0];
        const formattedAddress = result.formattedAddress || `${result.city || ''} ${result.state || ''}`.trim() || `Location (${lat}, ${lng})`;
        return {
          raw: formattedAddress,
          normalized: formattedAddress,
          street: result.streetName ? `${result.streetNumber || ''} ${result.streetName}`.trim() : '',
          city: result.city || '',
          province: result.administrativeLevels?.level1short || result.state || '',
          postalCode: result.zipcode || '',
          country: result.country || 'Canada',
          lat,
          lng,
        };
      } catch {
        // fall through
      }
    }
    return {
      raw: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      normalized: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      street: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'Canada',
      lat,
      lng,
    };
  }
};

/**
 * Format address for display
 * @param {Object} addressData - Address object
 * @returns {string} Formatted address string
 */
exports.formatAddress = (addressData) => {
  const parts = [];
  if (addressData.street) parts.push(addressData.street);
  if (addressData.city) parts.push(addressData.city);
  if (addressData.province) parts.push(addressData.province);
  if (addressData.postalCode) parts.push(addressData.postalCode);
  return parts.join(', ');
};
