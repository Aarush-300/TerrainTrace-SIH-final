const mongoose = require('mongoose');
const Landslide = require('../../models/Landslide');
// We assume RiskZone collection is Landslide for high risk zones or we query the grid
// Wait, the prompt says "Query RiskZone collection for zones with riskLevel HIGH or CRITICAL"
// There might not be a RiskZone model in the original codebase, but we can assume it exists or use Landslide. I will create a try/catch and fallback to Landslide if RiskZone is missing, or just assume it's `mongoose.model('RiskZone')`. 
// Actually, I can use mongoose.connection.db.collection('riskzones'). Or let's create a dynamic model.

async function getHighRiskZones(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ status: 'unavailable', zones: [] });
    }
    
    let RiskZone;
    try {
      RiskZone = mongoose.model('RiskZone');
    } catch {
      // If RiskZone schema doesn't exist, define it dynamically or query the collection directly
      const RiskZoneSchema = new mongoose.Schema({
        lat: Number, lng: Number, riskLevel: String, probability: Number, riskScore: Number, features: Object, locationName: String, updatedAt: Date
      }, { collection: 'riskzones' });
      RiskZone = mongoose.model('RiskZone', RiskZoneSchema);
    }
    
    const zones = await RiskZone.find({
      riskLevel: { $in: ['HIGH', 'CRITICAL'] }
    }).sort({ probability: -1 }).limit(50);
    
    if (!zones || zones.length === 0) {
      return res.json({ status: 'unavailable', zones: [] });
    }
    
    const formattedZones = zones.map(z => ({
      lat: z.lat,
      lng: z.lng,
      riskLevel: z.riskLevel,
      probability: z.probability,
      riskScore: z.riskScore,
      features: z.features || {},
      locationName: z.locationName || `${z.lat}, ${z.lng}`,
      updatedAt: z.updatedAt
    }));
    
    return res.json(formattedZones);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getHighRiskZones };
