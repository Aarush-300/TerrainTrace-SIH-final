const express = require('express');
const { getTriageTable, findRoute } = require('../controllers/routes.controller');
const router = express.Router();

router.get('/triage', getTriageTable);
router.get('/find', findRoute);

module.exports = router;
