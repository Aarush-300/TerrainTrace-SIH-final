const mongoose = require('mongoose');

const RiskZoneSchema = new mongoose.Schema({
  // All cells created by one model run share this identifier. It lets the API
  // swap to a complete prediction set instead of serving a partial refresh.
  batchId: { type: String, index: true },
  center_lat: Number,
  center_lng: Number,
  probability: Number,
  riskLevel: String,  // 'Low', 'Medium', 'High', 'Critical'
  elevation_m: Number,
  slope_deg: Number,
  fault_distance_m: Number,
  rainfall_3d_mm: Number,
  rainfall_24h_intensity: Number,
  soil_moisture_pct: Number,
  polygon: {          // GeoJSON Polygon for the grid cell
    type: { type: String, default: 'Polygon' },
    coordinates: [[[Number]]]
  },
  computedAt: { type: Date, default: Date.now }
});

RiskZoneSchema.index({ polygon: '2dsphere' });

module.exports = mongoose.model('RiskZone', RiskZoneSchema);
