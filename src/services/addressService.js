const NodeGeocoder = require('node-geocoder');
const axios = require('axios');
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

const nominatimUserAgent =
  process.env.GEOCODING_USER_AGENT ||
  'DoctorHouseCalls-Backend/1.0 (+https://github.com/Waqas0321/doctor_house_call_backend)';

const osmServer = (process.env.OSM_SERVER || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');

/** Nominatim requires a real User-Agent; pass contact email when possible (usage policy). */
function openStreetMapGeocoder() {
  const email = (process.env.NOMINATIM_CONTACT_EMAIL || process.env.EMAIL_USER || '').trim();
  return NodeGeocoder({
    provider: 'openstreetmap',
    formatter: null,
    osmServer,
    ...(email ? { email } : {}),
    headers: {
      'User-Agent': nominatimUserAgent,
      Accept: 'application/json',
    },
  });
}

function buildQueryVariants(address) {
  const t = String(address).trim();
  if (!t) return [];
  const set = new Set([
    t,
    `${t}, Canada`,
    `${t}, MB, Canada`,
    `${t}, Winnipeg, Manitoba, Canada`,
    `${t}, Winnipeg, MB`,
  ]);
  return [...set];
}

async function geocodeOnce(gc, query, rawForBooking) {
  const results = await gc.geocode(query);
  if (!results || results.length === 0) {
    return null;
  }
  return mapGeocodeResult(results[0], rawForBooking);
}

async function tryGeocoderWithVariants(gc, rawAddress) {
  const variants = buildQueryVariants(rawAddress);
  for (const q of variants) {
    try {
      const mapped = await geocodeOnce(gc, q, rawAddress);
      if (mapped && Number.isFinite(mapped.lat) && Number.isFinite(mapped.lng)) {
        return mapped;
      }
    } catch {
      // try next variant / provider
    }
  }
  return null;
}

/**
 * Photon (Komoot) — no API key; used when Nominatim returns nothing.
 */
async function tryPhotonGeocode(rawAddress) {
  const variants = buildQueryVariants(rawAddress);
  const ua = nominatimUserAgent;
  for (const q of variants) {
    try {
      const { data } = await axios.get('https://photon.komoot.io/api/', {
        params: { q, limit: 1 },
        timeout: 15000,
        headers: { 'User-Agent': ua, Accept: 'application/json' },
      });
      const f = data?.features?.[0];
      if (!f?.geometry?.coordinates?.length) continue;
      const [lng, lat] = f.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const p = f.properties || {};
      const normalized =
        [p.housenumber, p.street, p.city, p.state, p.postcode, p.country]
          .filter(Boolean)
          .join(', ')
          .trim() || q;
      return {
        raw: rawAddress,
        normalized,
        street: [p.housenumber, p.street].filter(Boolean).join(' ').trim(),
        city: p.city || p.town || p.district || '',
        province: p.state || '',
        postalCode: p.postcode || '',
        country: p.country || 'Canada',
        lat,
        lng,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Winnipeg centroid — last resort for admin manual booking when geocoders fail.
 * Set GEOCODING_FALLBACK_LAT / GEOCODING_FALLBACK_LNG to override.
 */
exports.buildAdminUngeocodedAddress = (rawAddress) => {
  const raw = String(rawAddress).trim();
  const lat = parseFloat(process.env.GEOCODING_FALLBACK_LAT || '49.8951', 10);
  const lng = parseFloat(process.env.GEOCODING_FALLBACK_LNG || '-97.1384', 10);
  return {
    raw,
    normalized: `${raw} (coordinates approximate — update booking with map pin or full address when known)`,
    street: '',
    city: 'Winnipeg',
    province: 'MB',
    postalCode: '',
    country: 'Canada',
    lat: Number.isFinite(lat) ? lat : 49.8951,
    lng: Number.isFinite(lng) ? lng : -97.1384,
  };
};

/**
 * Normalize and geocode an address
 * @param {string} address - Raw address string
 * @returns {Promise<Object>} Normalized address with coordinates
 */
exports.normalizeAndGeocode = async (address) => {
  const trimmed = String(address).trim();
  if (!trimmed) {
    throw new Error('Address is required');
  }

  let mapped = await tryGeocoderWithVariants(geocoder, trimmed);
  if (mapped) return mapped;

  mapped = await tryGeocoderWithVariants(openStreetMapGeocoder(), trimmed);
  if (mapped) return mapped;

  mapped = await tryPhotonGeocode(trimmed);
  if (mapped) return mapped;

  throw new Error('Address could not be geocoded');
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
    const formattedAddress =
      result.formattedAddress ||
      `${result.city || ''} ${result.state || ''}`.trim() ||
      `Location (${lat}, ${lng})`;

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
        const osm = openStreetMapGeocoder();
        const results = await osm.reverse({ lat, lon: lng });
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
        const formattedAddress =
          result.formattedAddress ||
          `${result.city || ''} ${result.state || ''}`.trim() ||
          `Location (${lat}, ${lng})`;
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
 * @returns {string} Formatted address
 */
exports.formatAddress = (addressData) => {
  const parts = [];
  if (addressData.street) parts.push(addressData.street);
  if (addressData.city) parts.push(addressData.city);
  if (addressData.province) parts.push(addressData.province);
  if (addressData.postalCode) parts.push(addressData.postalCode);
  return parts.join(', ');
};
