const express = require('express');
const { getAssets, getRoads } = require('../controllers/assets.controller');
const router = express.Router();

router.get('/', getAssets);
router.get('/roads', getRoads);

module.exports = router;
