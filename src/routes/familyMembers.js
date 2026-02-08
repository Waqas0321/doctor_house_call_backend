const express = require('express');
const router = express.Router();
const {
  getFamilyMembers,
  getFamilyMember,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember
} = require('../controllers/familyMemberController');
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');

router.use(protect);

router.route('/')
  .get(getFamilyMembers)
  .post((req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'Image must be less than 5MB' });
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({ success: false, error: err.message });
        }
        next(err);
      } else {
        next();
      }
    });
  }, createFamilyMember);

router.route('/:id')
  .get(getFamilyMember)
  .put((req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'Image must be less than 5MB' });
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({ success: false, error: err.message });
        }
        next(err);
      } else {
        next();
      }
    });
  }, updateFamilyMember)
  .delete(deleteFamilyMember);

module.exports = router;
