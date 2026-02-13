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
  updateProfile,
  uploadProfilePicture,
  deleteAccount,
  registerDevice
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');

// Registration & Login
router.post('/register', register);
router.post('/register-admin', registerAdmin);
router.post('/login', login);

// Social Auth (App)
router.post('/oauth', oauthLogin);
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);
router.post('/apple', appleAuth);

// Get current authenticated user (includes profilePicture / profilePictureUrl)
router.get('/me', protect, getMe);

// Update user profile (JSON or multipart with optional image)
router.put('/profile', protect, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, error: 'Image must be less than 5MB' });
      if (err.message && err.message.includes('Invalid file type')) return res.status(400).json({ success: false, error: err.message });
      return next(err);
    }
    next();
  });
}, updateProfile);

// Upload profile picture only (multipart, Cloudinary)
router.post('/profile/picture', protect, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, error: 'Image must be less than 5MB' });
      if (err.message && err.message.includes('Invalid file type')) return res.status(400).json({ success: false, error: err.message });
      return next(err);
    }
    next();
  });
}, uploadProfilePicture);

// Delete account (app)
router.delete('/account', protect, deleteAccount);

// Register device for push notifications
router.post('/device', protect, registerDevice);

module.exports = router;
