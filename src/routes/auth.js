const express = require('express');
const router = express.Router();
const {
  register,
  registerAdmin,
  login,
  oauthLogin,
  googleAuth,
  facebookAuth,
  appleAuth,
  getMe,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Registration & Login
router.post('/register', register);
router.post('/register-admin', registerAdmin);
router.post('/login', login);

// Social Auth (App)
router.post('/oauth', oauthLogin);
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);
router.post('/apple', appleAuth);

// Get current authenticated user
router.get('/me', protect, getMe);

// Update user profile
router.put('/profile', protect, updateProfile);

module.exports = router;
