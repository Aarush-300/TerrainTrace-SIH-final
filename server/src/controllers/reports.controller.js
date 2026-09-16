const mongoose = require('mongoose');
const FieldReport = require('../../models/FieldReport');
const { parseLocation, validationError } = require('../utils/validation');

const REPORT_TYPES = new Set(['CRACK', 'SLOPE_MOVEMENT', 'LANDSLIDE', 'ROCKFALL', 'ROAD_BLOCKAGE', 'OTHER']);

function optionalText(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw validationError(`${fieldName} must be a string`);
  return value.trim();
}

async function createReport(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Report storage is currently unavailable' });
    }

    const location = parseLocation(req.body || {});
    const type = String(req.body?.type || '').toUpperCase();
    if (!REPORT_TYPES.has(type)) throw validationError(`type must be one of: ${[...REPORT_TYPES].join(', ')}`);

    const report = await FieldReport.create({
      latitude: location.latitude,
      longitude: location.longitude,
      type,
      description: optionalText(req.body?.description, 'description'),
      imageReference: optionalText(req.body?.image_reference ?? req.body?.imageReference, 'image_reference'),
      videoReference: optionalText(req.body?.video_reference ?? req.body?.videoReference, 'video_reference'),
      mediaPath: optionalText(req.body?.mediaPath, 'mediaPath'),
      severity: req.body?.severity,
      reportedAt: location.timestamp ? new Date(location.timestamp) : new Date(),
      location: { type: 'Point', coordinates: [location.longitude, location.latitude] }
    });

    return res.status(201).json({
      id: report.id,
      status: 'accepted',
      reported_at: report.reportedAt.toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

async function getReports(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Report storage is currently unavailable' });
    }
    const { status, type, limit = 50, offset = 0 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    const reports = await FieldReport.find(filter)
      .sort({ reportedAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));
    return res.json(reports);
  } catch (error) {
    return next(error);
  }
}

async function getReportById(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Report storage is currently unavailable' });
    }
    const report = await FieldReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

async function updateReportStatus(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Report storage is currently unavailable' });
    }
    const { status } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw validationError('status must be VERIFIED or REJECTED');
    }
    const report = await FieldReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createReport, getReports, getReportById, updateReportStatus, REPORT_TYPES };
