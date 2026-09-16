const express = require('express');
const { getHighRiskZones } = require('../controllers/safety.controller');
const router = express.Router();

router.get('/zones', getHighRiskZones);

module.exports = router;
