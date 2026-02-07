const NodeGeocoder = require('node-geocoder');

const options = {
  provider: process.env.GEOCODING_PROVIDER || 'google',
  apiKey: process.env.GEOCODING_API_KEY,
  formatter: null
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;
