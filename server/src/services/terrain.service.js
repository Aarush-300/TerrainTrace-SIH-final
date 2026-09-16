const axios = require('axios');
const { TtlCache } = require('../utils/cache');

const cache = new TtlCache(Number(process.env.TERRAIN_CACHE_TTL_MS) || 24 * 60 * 60 * 1000);
const ELEVATION_URL = process.env.ELEVATION_URL || 'https://api.open-meteo.com/v1/elevation';
const METRES_PER_LATITUDE_DEGREE = 111_320;

function cacheKey({ latitude, longitude }) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function calculateSlope(elevations, latitude) {
  const [north, south, east, west] = elevations;
  if (![north, south, east, west].every(Number.isFinite)) return undefined;

  const northSouthMetres = 200;
  const eastWestMetres = 200 * Math.max(Math.cos(latitude * Math.PI / 180), 0.1);
  const riseNorthSouth = (north - south) / northSouthMetres;
  const riseEastWest = (east - west) / eastWestMetres;
  return Math.atan(Math.hypot(riseNorthSouth, riseEastWest)) * 180 / Math.PI;
}

async function getTerrainFeatures(location) {
  const key = cacheKey(location);
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const latitudeStep = 100 / METRES_PER_LATITUDE_DEGREE;
  const longitudeStep = 100 / (METRES_PER_LATITUDE_DEGREE * Math.max(Math.cos(location.latitude * Math.PI / 180), 0.1));
  const latitude = [location.latitude + latitudeStep, location.latitude - latitudeStep, location.latitude, location.latitude, location.latitude];
  const longitude = [location.longitude, location.longitude, location.longitude + longitudeStep, location.longitude - longitudeStep, location.longitude];

  try {
    const response = await axios.get(ELEVATION_URL, {
      params: { latitude: latitude.join(','), longitude: longitude.join(',') },
      timeout: Number(process.env.TERRAIN_TIMEOUT_MS) || 8000
    });
    const elevations = response.data?.elevation;
    const values = {
      elevation: Array.isArray(elevations) && Number.isFinite(elevations[4]) ? elevations[4] : undefined,
      slope: Array.isArray(elevations) ? calculateSlope(elevations, location.latitude) : undefined
    };
    const result = {
      values,
      dataTimestamp: null,
      source: 'open-meteo-elevation',
      status: Object.values(values).some((value) => value !== undefined) ? 'ok' : 'unavailable'
    };
    cache.set(key, result);
    return result;
  } catch (error) {
    return {
      values: {},
      dataTimestamp: null,
      source: 'open-meteo-elevation',
      status: 'unavailable',
      error: error.message
    };
  }
}

module.exports = { getTerrainFeatures, calculateSlope };
