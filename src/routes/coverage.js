const express = require('express');
const router = express.Router();
const { getActiveZones, checkServiceCoverage } = require('../controllers/coverageController');

router.get('/zones', getActiveZones);
router.post('/check', checkServiceCoverage);

module.exports = router;
