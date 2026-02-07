const express = require('express');
const router = express.Router();
const { checkServiceCoverage } = require('../controllers/coverageController');

router.post('/check', checkServiceCoverage);

module.exports = router;
