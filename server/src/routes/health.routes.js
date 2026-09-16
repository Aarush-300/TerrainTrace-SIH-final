const express = require('express');
const { health } = require('../controllers/health.controller');

const router = express.Router();
router.get('/', health);

module.exports = router;
