const express = require('express');
const router = express.Router();
const {
  getActiveZones,
  checkServiceCoverage,
  autocomplete,
} = require('../controllers/coverageController');

router.get('/zones', getActiveZones);
router.get('/autocomplete', autocomplete);
router.post('/check', checkServiceCoverage);

module.exports = router;
