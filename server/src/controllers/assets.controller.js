const axios = require('axios');
const FieldReport = require('../../models/FieldReport');
const { TtlCache } = require('../utils/cache');

const cache = new TtlCache(60 * 60 * 1000); // 1 hour
const roadCache = new TtlCache(30 * 60 * 1000); // 30 min

async function getAssets(req, res, next) {
  try {
    const { south, north, east, west } = req.query;
    if (!south || !north || !east || !west) return res.status(400).json({ error: 'Bounds are required' });

    const key = `assets-${south}-${north}-${east}-${west}`;
    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const query = `
      [out:json];
      (
        node["amenity"~"school|hospital"](${south},${west},${north},${east});
        way["amenity"~"school|hospital"](${south},${west},${north},${east});
        node["place"~"village"](${south},${west},${north},${east});
      );
      out center;
    `;
    
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const features = response.data.elements.map(el => {
      const lat = el.lat || el.center.lat;
      const lon = el.lon || el.center.lon;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: el.tags || {}
      };
    });

    const featureCollection = { type: 'FeatureCollection', features };
    cache.set(key, featureCollection);
    return res.json(featureCollection);
  } catch (error) {
    return next(error);
  }
}

async function getRoads(req, res, next) {
  try {
    const { south, north, east, west } = req.query;
    if (!south || !north || !east || !west) return res.status(400).json({ error: 'Bounds are required' });

    const key = `roads-${south}-${north}-${east}-${west}`;
    const cached = roadCache.get(key);
    if (cached) return res.json(cached);

    const query = `
      [out:json];
      way["highway"~"primary|secondary|tertiary"](${south},${west},${north},${east});
      out geom;
    `;
    
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const roadFeatures = response.data.elements.map(el => {
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: el.geometry.map(g => [g.lon, g.lat]) },
        properties: { ...el.tags, id: el.id, blocked: false }
      };
    });

    // Cross-reference with FieldReports
    if (require('mongoose').connection.readyState === 1) {
      const blockageReports = await FieldReport.find({
        type: 'ROAD_BLOCKAGE',
        status: 'VERIFIED',
        latitude: { $gte: Number(south), $lte: Number(north) },
        longitude: { $gte: Number(west), $lte: Number(east) }
      });
      
      // Simple bounding box check for 500m (approx 0.0045 deg)
      const threshold = 0.0045;
      for (const report of blockageReports) {
        for (const road of roadFeatures) {
          if (road.properties.blocked) continue;
          for (const coord of road.geometry.coordinates) {
            if (Math.abs(coord[0] - report.longitude) < threshold && Math.abs(coord[1] - report.latitude) < threshold) {
              road.properties.blocked = true;
              break;
            }
          }
        }
      }
    }

    const featureCollection = { type: 'FeatureCollection', features: roadFeatures };
    roadCache.set(key, featureCollection);
    return res.json(featureCollection);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAssets, getRoads };
