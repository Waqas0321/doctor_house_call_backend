const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBooking
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/', protect, getMyBookings);
router.get('/:id', protect, getBooking);

module.exports = router;
