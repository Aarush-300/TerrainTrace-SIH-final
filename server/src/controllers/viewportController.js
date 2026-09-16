/**
 * Viewport batch-prediction controller.
 *
 * Accepts the current map viewport (bounds + zoom) and returns a GeoJSON
 * FeatureCollection of Point features, each carrying a live AI risk
 * prediction.  Points are spaced according to zoom level and capped at
 * ~100 per request to avoid overloading upstream APIs.
 */

const { parseLocation } = require('../utils/validation');
const { getRiskLevel } = require('../utils/risk-levels');
const { getWeatherFeaturesBatch } = require('../services/weather.service');
const { getTerrainFeaturesBatch } = require('../services/terrain.service');
const { getGeologyFeatures } = require('../services/geology.service');
const mlService = require('../services/ml.service');
const { TtlCache } = require('../utils/cache');
const { getSlope } = require('../utils/demReader');

// ── Configuration ──────────────────────────────────────────────────────
const MAX_POINTS = 12000;
const VIEWPORT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const cache = new TtlCache(VIEWPORT_CACHE_TTL);

// ── Helpers ────────────────────────────────────────────────────────────

/** Pick a sampling step (degrees) based on zoom level. */
function stepForZoom(zoom) {
  if (zoom <= 7)  return 0.5;
  if (zoom <= 9)  return 0.25;
  if (zoom <= 11) return 0.1;
  return 0.05;
}

/** Round a coordinate to the step's precision for cache-key stability. */
function snap(value, step) {
  return Math.round(value / step) * step;
}

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

// ── Controller ─────────────────────────────────────────────────────────

/**
 * POST /api/risk/viewport
 *
 * Body: { bounds: { north, south, east, west }, zoom }
 */
async function getViewportRisk(req, res, next) {
  try {
    const { bounds, zoom } = req.body || {};

    if (!bounds || zoom == null) {
      return res.status(400).json({ error: 'bounds and zoom are required' });
    }

    const latSpan = Math.abs(bounds.north - bounds.south);
    const lngSpan = Math.abs(bounds.east - bounds.west);
    const targetPoints = 400;
    
    let step = Math.sqrt((latSpan * lngSpan) / targetPoints);
    step = Math.max(0.05, Math.min(1.0, step));

    const startLat = Math.min(bounds.south, bounds.north);
    const endLat   = Math.max(bounds.south, bounds.north);
    const startLng = Math.min(bounds.west, bounds.east);
    const endLng   = Math.max(bounds.west, bounds.east);

    const centerLat = (startLat + endLat) / 2;
    const centerLng = (startLng + endLng) / 2;
    
    // Geology uses center point
    const geologyData = await getGeologyFeatures({ latitude: centerLat, longitude: centerLng });
    const geologyFeats = geologyData.values || {};

    const pointsToProcess = [];
    const cachedFeatures = [];

    // 1. Generate grid points
    let pointsCount = 0;
    for (let lat = startLat; lat <= endLat; lat += step) {
      for (let lng = startLng; lng <= endLng; lng += step) {
        if (pointsCount >= MAX_POINTS) break;
        pointsCount++;
        
        const jitterLat = (Math.random() - 0.5) * (step * 0.8);
        const jitterLng = (Math.random() - 0.5) * (step * 0.8);
        
        const pLat = Math.round((lat + jitterLat) * 10000) / 10000;
        const pLng = Math.round((lng + jitterLng) * 10000) / 10000;
        
        // 2. Check cache
        const key = cacheKey(pLat, pLng);
        const cached = cache.get(key);
        
        if (cached) {
          cachedFeatures.push(cached);
        } else {
          pointsToProcess.push({ pLat, pLng, key });
        }
      }
      if (pointsCount >= MAX_POINTS) break;
    }

    // 3. For uncached points, read slope
    const validUncachedPoints = [];
    for (const p of pointsToProcess) {
      try {
        const slopeDeg = await getSlope(p.pLat, p.pLng);
        if (slopeDeg >= 5.0) {
          validUncachedPoints.push({ ...p, slopeDeg });
        }
      } catch (err) {
        console.error(`Error reading slope for ${p.pLat}, ${p.pLng}:`, err.message);
      }
    }

    // 4. Batch fetch weather and terrain for valid points
    const batchLocs = validUncachedPoints.map(p => ({ latitude: p.pLat, longitude: p.pLng }));
    let weatherBatchResults = [];
    let terrainBatchResults = [];

    if (batchLocs.length > 0) {
      [weatherBatchResults, terrainBatchResults] = await Promise.all([
        getWeatherFeaturesBatch(batchLocs),
        getTerrainFeaturesBatch(batchLocs)
      ]);
    }

    // 5. Build features array for batch prediction
    const batchFeatures = validUncachedPoints.map((p, i) => {
      const weather = weatherBatchResults[i]?.values || {};
      const terrain = terrainBatchResults[i]?.values || {};
      const elevation = terrain.elevation !== undefined ? terrain.elevation : p.slopeDeg * 100;
      
      return {
        rainfall_24h_intensity: weather.rainfall_24h,
        rainfall_3d_mm: weather.rainfall_3d,
        soil_moisture_pct: weather.soil_moisture,
        elevation_m: elevation,
        slope_deg: p.slopeDeg, // DEM slope preferred
        lithology: geologyFeats.lithology,
        fault_distance_m: geologyFeats.fault_distance
      };
    });

    const newFeatures = [];
    if (batchFeatures.length > 0) {
      // 6. Single call to predictBatch
      const predictions = await mlService.predictBatch(batchFeatures);
      
      // 7. Map results back
      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        const pt = validUncachedPoints[i];
        const feats = batchFeatures[i];
        
        const riskLevel = getRiskLevel(pred.probability);
        
        const feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pt.pLng, pt.pLat] },
          properties: {
            center_lat:             pt.pLat,
            center_lng:             pt.pLng,
            probability:            pred.probability,
            riskLevel,
            risk_score:             pred.riskScore,
            confidence:             pred.confidence,
            elevation_m:            feats.elevation_m,
            slope_deg:              feats.slope_deg,
            rainfall_3d_mm:         feats.rainfall_3d_mm,
            rainfall_24h_intensity: feats.rainfall_24h_intensity,
            soil_moisture_pct:      feats.soil_moisture_pct,
            fault_distance_m:       feats.fault_distance_m,
            computedAt:             new Date().toISOString(),
          },
        };
        cache.set(pt.key, feature);
        newFeatures.push(feature);
      }
    }

    const features = [...cachedFeatures, ...newFeatures];

    // 8. Return
    return res.json({
      type: 'FeatureCollection',
      features,
      meta: {
        requested: pointsCount,
        returned:  features.length,
        step,
        zoom: Number(zoom),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Viewport Error:", error);
    return next(error);
  }
}

module.exports = { getViewportRisk };

