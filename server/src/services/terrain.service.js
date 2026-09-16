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

async function getTerrainFeaturesBatch(locations) {
  const results = new Array(locations.length);
  const uncachedIndices = [];
  const uncachedLocations = [];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const key = cacheKey(loc);
    const cached = cache.get(key);
    if (cached) {
      results[i] = { ...cached, cached: true };
    } else {
      uncachedIndices.push(i);
      uncachedLocations.push(loc);
    }
  }

  if (uncachedLocations.length === 0) {
    return results;
  }

  // 5 sample points per location => 50 locations = 250 points max
  const MAX_LOCS_PER_BATCH = 50; 
  for (let i = 0; i < uncachedLocations.length; i += MAX_LOCS_PER_BATCH) {
    const batchLocs = uncachedLocations.slice(i, i + MAX_LOCS_PER_BATCH);
    const batchIndices = uncachedIndices.slice(i, i + MAX_LOCS_PER_BATCH);
    
    const flatLats = [];
    const flatLons = [];
    
    for (const loc of batchLocs) {
      const latitudeStep = 100 / METRES_PER_LATITUDE_DEGREE;
      const longitudeStep = 100 / (METRES_PER_LATITUDE_DEGREE * Math.max(Math.cos(loc.latitude * Math.PI / 180), 0.1));
      flatLats.push(loc.latitude + latitudeStep, loc.latitude - latitudeStep, loc.latitude, loc.latitude, loc.latitude);
      flatLons.push(loc.longitude, loc.longitude, loc.longitude + longitudeStep, loc.longitude - longitudeStep, loc.longitude);
    }

    try {
      const response = await axios.get(ELEVATION_URL, {
        params: { latitude: flatLats.join(','), longitude: flatLons.join(',') },
        timeout: Number(process.env.TERRAIN_TIMEOUT_MS) || 8000
      });
      
      const elevations = response.data?.elevation || [];
      
      for (let j = 0; j < batchLocs.length; j++) {
        const loc = batchLocs[j];
        const startIndex = j * 5;
        const locElevations = elevations.slice(startIndex, startIndex + 5);
        
        const values = {
          elevation: locElevations.length === 5 && Number.isFinite(locElevations[4]) ? locElevations[4] : undefined,
          slope: locElevations.length === 5 ? calculateSlope(locElevations, loc.latitude) : undefined
        };
        const result = {
          values,
          dataTimestamp: null,
          source: 'open-meteo-elevation',
          status: Object.values(values).some((value) => value !== undefined) ? 'ok' : 'unavailable'
        };
        const locIndex = batchIndices[j];
        const key = cacheKey(loc);
        cache.set(key, result);
        results[locIndex] = result;
      }
    } catch (error) {
      for (let j = 0; j < batchIndices.length; j++) {
        const locIndex = batchIndices[j];
        results[locIndex] = {
          values: {},
          dataTimestamp: null,
          source: 'open-meteo-elevation',
          status: 'unavailable',
          error: error.message
        };
      }
    }
  }

  return results;
}

module.exports = { getTerrainFeatures, getTerrainFeaturesBatch, calculateSlope };
