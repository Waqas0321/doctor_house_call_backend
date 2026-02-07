const app = require('../src/app');
const mongoose = require('mongoose');

let connectionPromise = null;

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
  const connected = await connectDB();
  
  if (!connected) {
    return res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable. Please try again.',
    });
  }

  return app(req, res);
};
