const express = require('express');
const { createReport, getReports, getReportById, updateReportStatus } = require('../controllers/reports.controller');

const router = express.Router();
router.get('/', getReports);
router.get('/:id', getReportById);
router.patch('/:id/status', updateReportStatus);
router.post('/', createReport);

module.exports = router;
