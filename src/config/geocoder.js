const NodeGeocoder = require('node-geocoder');

/**
 * Google Maps Geocoding: set GEOCODING_API_KEY or GOOGLE_MAPS_API_KEY to a valid
 * Maps key (typically starts with AIza…). Placeholder or invalid values are ignored
 * and OpenStreetMap / Nominatim is used so you do not get REQUEST_DENIED at runtime.
 *
 * Env:
 * - GEOCODING_PROVIDER=openstreetmap → always use OSM (no Google)
 * - OSM_SERVER → optional Nominatim base (default https://nominatim.openstreetmap.org)
 */
const googleKey =
  (process.env.GEOCODING_API_KEY && process.env.GEOCODING_API_KEY.trim()) ||
  (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim()) ||
  '';

/** Browser / server keys are typically AIza…; placeholders avoid hitting Google and getting REQUEST_DENIED */
const looksLikeValidGoogleMapsKey = (k) =>
  typeof k === 'string' && /^AIza[0-9A-Za-z_-]{30,}$/.test(k.trim());

const explicitProvider = (process.env.GEOCODING_PROVIDER || '').trim().toLowerCase();
const osmServer = (process.env.OSM_SERVER || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');

let options;
if (explicitProvider === 'openstreetmap') {
  options = {
    provider: 'openstreetmap',
    formatter: null,
    osmServer,
  };
} else if (googleKey && looksLikeValidGoogleMapsKey(googleKey)) {
  options = {
    provider: 'google',
    apiKey: googleKey.trim(),
    formatter: null,
  };
} else {
  options = {
    provider: 'openstreetmap',
    formatter: null,
    osmServer,
  };
}

module.exports = NodeGeocoder(options);
