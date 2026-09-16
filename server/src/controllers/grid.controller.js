const mongoose = require('mongoose');
const RiskZone = require('../../models/RiskZone');
const RiskZoneBatch = require('../../models/RiskZoneBatch');

function toFeatureCollection(zones) {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) => ({
      type: 'Feature',
      geometry: zone.polygon,
      properties: {
        id: zone._id,
        center_lat: zone.center_lat,
        center_lng: zone.center_lng,
        probability: zone.probability,
        riskLevel: zone.riskLevel,
        elevation_m: zone.elevation_m,
        slope_deg: zone.slope_deg,
        fault_distance_m: zone.fault_distance_m,
        rainfall_3d_mm: zone.rainfall_3d_mm,
        rainfall_24h_intensity: zone.rainfall_24h_intensity,
        soil_moisture_pct: zone.soil_moisture_pct,
        computedAt: zone.computedAt
      }
    }))
  };
}

async function getCurrentZones() {
  const activeBatch = await RiskZoneBatch.findOne({ isActive: true }).sort({ computedAt: -1 }).lean();
  if (activeBatch) return RiskZone.find({ batchId: activeBatch.batchId }).lean();
  return RiskZone.find({ batchId: { $exists: false } }).lean();
}

async function getRiskGrid(_req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ type: 'FeatureCollection', features: [], status: 'unavailable', data_timestamp: null });
    }
    const zones = await getCurrentZones();
    const result = toFeatureCollection(zones);
    result.status = zones.length ? 'ok' : 'empty';
    result.data_timestamp = zones[0]?.computedAt || null;
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getRiskGrid, getCurrentZones, toFeatureCollection };
