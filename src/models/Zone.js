const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  boundaryData: {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: [[[Number]]], // Array of coordinate arrays for polygon
      required: true
    }
  },
  allowPhoneCall: {
    type: Boolean,
    default: true
  },
  allowHouseCall: {
    type: Boolean,
    default: true
  },
  phoneCallsFull: {
    type: Boolean,
    default: false
  },
  houseCallsFull: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for active zones lookup
zoneSchema.index({ isActive: 1, priority: -1 });

module.exports = mongoose.model('Zone', zoneSchema);
