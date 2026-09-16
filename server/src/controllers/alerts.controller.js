const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Alert = require('../../models/Alert');
const { buildCapXml, buildCapFeed } = require('../services/cap.service');
const { validationError } = require('../utils/validation');

async function createAlert(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const data = req.body;
    if (!data.severity || !data.headline || !data.description || !data.areaDesc) {
      throw validationError('Missing required fields: severity, headline, description, areaDesc');
    }
    
    const alert = await Alert.create({
      identifier: uuidv4(),
      severity: data.severity,
      headline: data.headline,
      description: data.description,
      areaDesc: data.areaDesc,
      circle: data.circle,
      sender: data.sender || 'TerrainTrace',
      status: data.status || 'Actual',
      msgType: data.msgType || 'Alert',
      scope: data.scope || 'Public',
      certainty: data.certainty || 'Observed',
      urgency: data.urgency || 'Immediate',
      expires: data.expires ? new Date(data.expires) : undefined,
      deliveryChannels: data.deliveryChannels || []
    });
    
    const cap_xml = buildCapXml(alert);
    return res.status(201).json({ id: alert._id, identifier: alert.identifier, cap_xml });
  } catch (error) {
    return next(error);
  }
}

async function getAlerts(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const { severity, active, limit = 50, offset = 0 } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (active === 'true') {
      filter.$or = [
        { expires: { $exists: false } },
        { expires: null },
        { expires: { $gt: new Date() } }
      ];
    }
    
    const alerts = await Alert.find(filter)
      .sort({ sent: -1 })
      .skip(Number(offset))
      .limit(Number(limit));
      
    return res.json(alerts);
  } catch (error) {
    return next(error);
  }
}

async function getAlertFeed(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).send('Database unavailable');
    }
    
    const filter = {
      $or: [
        { expires: { $exists: false } },
        { expires: null },
        { expires: { $gt: new Date() } }
      ]
    };
    
    const alerts = await Alert.find(filter).sort({ sent: -1 }).limit(100);
    const xml = buildCapFeed(alerts);
    
    res.set('Content-Type', 'application/xml');
    return res.send(xml);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createAlert, getAlerts, getAlertFeed };
