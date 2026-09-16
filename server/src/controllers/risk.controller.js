const { parseLocation } = require('../utils/validation');
const { getRiskLevel } = require('../utils/risk-levels');
const { collectFeatures } = require('../services/feature.service');
const mlService = require('../services/ml.service');

function publicPartialResponse(location, collected) {
  return {
    status: 'partial',
    location: { latitude: location.latitude, longitude: location.longitude },
    missing_features: collected.missingFeatures,
    features: collected.features,
    data_timestamp: collected.dataTimestamp,
    source_status: collected.providerStatus
  };
}

async function buildPrediction(payload) {
  const location = parseLocation(payload);
  const collected = await collectFeatures(location);
  // Proceed with prediction even if some features are missing.
  // CatBoost natively handles missing numerical values as np.nan.
  const prediction = await mlService.predict(collected.features);
  return {
    status: 200,
    body: {
      status: collected.missingFeatures.length ? 'partial' : 'ok',
      location: { latitude: location.latitude, longitude: location.longitude },
      risk_score: prediction.riskScore,
      risk_level: getRiskLevel(prediction.probability),
      probability: prediction.probability,
      confidence: prediction.confidence,
      model_version: prediction.modelVersion,
      features: collected.features,
      ...(collected.missingFeatures.length ? { missing_features: collected.missingFeatures } : {}),
      data_timestamp: collected.dataTimestamp,
      source_status: collected.providerStatus
    }
  };
}

async function predictRisk(req, res, next) {
  try {
    const result = await buildPrediction(req.body || {});
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
}

// Kept as a small compatibility adapter for the existing map UI. New clients
// should use /api/risk/predict and its latitude/longitude field names.
async function predictPointLegacy(req, res, next) {
  try {
    const result = await buildPrediction({
      latitude: req.body?.lat,
      longitude: req.body?.lng,
      timestamp: req.body?.timestamp
    });
    if (result.status !== 200) return res.status(result.status).json(result.body);
    const body = result.body;
    return res.json({
      lat: body.location.latitude,
      lng: body.location.longitude,
      probability: body.probability,
      riskLevel: body.risk_level[0] + body.risk_level.slice(1).toLowerCase(),
      features: body.features,
      status: body.status,
      ...(body.missing_features ? { missing_features: body.missing_features } : {})
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { buildPrediction, predictRisk, predictPointLegacy };
