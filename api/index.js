const app = require('../src/app');
const mongoose = require('mongoose');

let connectionPromise = null;

/**
 * CORS must run for every response from this handler. Express app also uses cors(),
 * but OPTIONS preflight and DB errors are answered here before app() — without this,
 * browsers show "No Access-Control-Allow-Origin" on preflight or 503.
 */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  );
  const requested = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    requested || 'Content-Type, Authorization, X-Requested-With, Accept'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Connect to MongoDB for serverless (reuse connection across invocations)
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return true;

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in Vercel environment variables');
    return false;
  }

  // Prevent multiple simultaneous connection attempts
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
  }).then(() => true).catch((err) => {
    console.error('MongoDB connection error:', err.message);
    connectionPromise = null;
    return false;
  });

  return connectionPromise;
};

module.exports = async (req, res) => {
  applyCors(req, res);

  // Preflight: answer without waiting for Mongo (avoids CORS failure on slow/failed DB)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const connected = await connectDB();

  if (!connected) {
    return res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable. Please try again.',
    });
  }

  return app(req, res);
};
