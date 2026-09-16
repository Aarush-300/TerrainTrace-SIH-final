const express = require('express');
const { createAlert, getAlerts, getAlertFeed } = require('../controllers/alerts.controller');
const router = express.Router();

router.post('/', createAlert);
router.get('/', getAlerts);
router.get('/feed.xml', getAlertFeed);

module.exports = router;
