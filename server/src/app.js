const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Landslide = require('../models/Landslide');
const riskRoutes = require('./routes/risk.routes');
const reportRoutes = require('./routes/reports.routes');
const healthRoutes = require('./routes/health.routes');
const { predictPointLegacy } = require('./controllers/risk.controller');
const { getRiskGrid, getCurrentZones } = require('./controllers/grid.controller');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/risk', riskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/health', healthRoutes);
app.get('/health', (_req, res) => res.redirect(307, '/api/health'));

// Existing frontend endpoints remain as adapters while new clients use the
// stable /api/risk API above. They do not expose Python implementation details.
app.post('/api/predict-point', predictPointLegacy);
app.get('/api/risk-zones', getRiskGrid);
app.post('/api/risk-zones/refresh', async (_req, res) => {
  res.status(202).json({
    status: 'accepted',
    message: 'Grid refresh is intentionally externalized; read the current cached grid from /api/risk/grid.'
  });
});

app.get('/api/landslides', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const { latMin, latMax, lonMin, lonMax } = req.query;
    let query = {};
    if ([latMin, latMax, lonMin, lonMax].some((value) => value !== undefined)) {
      const values = [latMin, latMax, lonMin, lonMax].map(Number);
      if (values.some((value) => !Number.isFinite(value)) || values[0] > values[1] || values[2] > values[3]) {
        return res.status(400).json({ error: 'Bounds must be finite numbers ordered as min then max' });
      }
      query = { latitude: { $gte: values[0], $lte: values[1] }, longitude: { $gte: values[2], $lte: values[3] } };
    }
    return res.json(await Landslide.find(query));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/stats', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ totalLandslides: 0, riskZonesCount: {}, lastComputedTimestamp: null });
    }
    const [totalLandslides, zones] = await Promise.all([Landslide.countDocuments(), getCurrentZones()]);
    const riskZonesCount = zones.reduce((counts, zone) => {
      if (zone.riskLevel) counts[zone.riskLevel] = (counts[zone.riskLevel] || 0) + 1;
      return counts;
    }, {});
    return res.json({ totalLandslides, riskZonesCount, lastComputedTimestamp: zones[0]?.computedAt || null });
  } catch (error) {
    return next(error);
  }
});

const assetsRoutes = require('./routes/assets.routes');
const safetyRoutes = require('./routes/safety.routes');
const alertRoutes = require('./routes/alerts.routes');
const emergencyRoutes = require('./routes/emergency.routes');

app.use('/api/assets', assetsRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/routes', emergencyRoutes);

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

app.use((error, _req, res, _next) => {
  if (error.name === 'MlServiceError') {
    const status = error.status || 502;
    return res.status(status).json({
      error: status >= 500 ? 'ML prediction service is unavailable' : 'ML prediction service rejected the feature set'
    });
  }
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error('[Server] Unhandled request error:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
