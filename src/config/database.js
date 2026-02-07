const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('Host:', process.env.MONGODB_URI.match(/@([^/]+)/)?.[1] || 'unknown');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('\n❌ Database connection error:', error.message);
    
    // Provide specific error messages
    if (error.message.includes('ETIMEOUT') || error.message.includes('queryTxt')) {
      console.error('\n🔍 DNS Resolution Failed - Possible causes:');
      console.error('1. MongoDB Atlas cluster might be PAUSED');
      console.error('   → Go to MongoDB Atlas → Clusters → Check if cluster is running');
      console.error('2. Cluster name might be incorrect');
      console.error('   → Verify the connection string in MongoDB Atlas → Connect');
      console.error('3. IP address not whitelisted');
      console.error('   → MongoDB Atlas → Network Access → Add IP Address (0.0.0.0/0 for dev)');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n🔍 Authentication Failed:');
      console.error('   → Check username and password in connection string');
    } else {
      console.error('\n💡 General troubleshooting:');
      console.error('1. Verify connection string in MongoDB Atlas → Connect → Connect your application');
      console.error('2. Check if cluster is running (not paused)');
      console.error('3. Ensure IP is whitelisted in Network Access');
      console.error('4. Check your internet connection');
    }
    
    console.error('\n📝 To get the correct connection string:');
    console.error('   1. Go to https://cloud.mongodb.com');
    console.error('   2. Click "Connect" on your cluster');
    console.error('   3. Select "Connect your application"');
    console.error('   4. Copy the connection string');
    console.error('   5. Replace <password> with your actual password');
    
    process.exit(1);
  }
};

module.exports = connectDB;
