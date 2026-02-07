const geocoder = require('../config/geocoder');

/**
 * Normalize and geocode an address
 * @param {string} address - Raw address string
 * @returns {Promise<Object>} Normalized address with coordinates
 */
exports.normalizeAndGeocode = async (address) => {
  try {
    const results = await geocoder.geocode(address);
    
    if (!results || results.length === 0) {
      throw new Error('Address could not be geocoded');
    }

    const result = results[0];
    
    return {
      raw: address,
      normalized: result.formattedAddress,
      street: result.streetName ? `${result.streetNumber || ''} ${result.streetName}`.trim() : '',
      city: result.city || '',
      province: result.administrativeLevels?.level1short || result.state || '',
      postalCode: result.zipcode || '',
      country: result.country || 'Canada',
      lat: result.latitude,
      lng: result.longitude
    };
  } catch (error) {
    throw new Error(`Geocoding failed: ${error.message}`);
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
        lng
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
      lng
    };
  } catch (error) {
    return {
      raw: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      normalized: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      street: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'Canada',
      lat,
      lng
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
