const express = require('express');
const { predictRisk } = require('../controllers/risk.controller');
const { getRiskGrid } = require('../controllers/grid.controller');
const { getViewportRisk } = require('../controllers/viewportController');

const router = express.Router();

router.post('/predict', predictRisk);
router.get('/grid', getRiskGrid);
router.post('/viewport', getViewportRisk);

module.exports = router;
