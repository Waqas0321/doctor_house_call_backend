const app = require('../src/app');
const mongoose = require('mongoose');

// Connect to MongoDB for serverless (reuse connection across invocations)
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('DB connect error:', err.message);
  }
  return app(req, res);
};
