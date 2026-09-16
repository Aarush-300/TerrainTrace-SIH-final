const axios = require('axios');
const { TtlCache } = require('../utils/cache');

const cache = new TtlCache(Number(process.env.WEATHER_CACHE_TTL_MS) || 10 * 60 * 1000);
const WEATHER_URL = process.env.WEATHER_URL || 'https://api.open-meteo.com/v1/forecast';

function cacheKey({ latitude, longitude }) {
  // Weather is spatially smooth at this scale. Rounding prevents a map click
  // from producing a new upstream request for every sub-metre coordinate.
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function sumKnown(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isFinite(value))) return undefined;
  return values.reduce((total, value) => total + value, 0);
}

function lastKnown(values) {
  if (!Array.isArray(values)) return undefined;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index];
  }
  return undefined;
}

function buildValues(payload) {
  const hourly = payload?.hourly || {};
  const precipitation = hourly.precipitation;
  const rainfall24h = sumKnown(precipitation?.slice(-24));
  const rainfall3d = sumKnown(precipitation?.slice(-72));
  const soil = lastKnown(hourly.soil_moisture_0_to_7cm);

  return {
    rainfall_24h: rainfall24h,
    rainfall_3d: rainfall3d,
    soil_moisture: soil === undefined ? undefined : soil * 100
  };
}

async function getWeatherFeatures(location) {
  const key = cacheKey(location);
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  try {
    const response = await axios.get(WEATHER_URL, {
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        hourly: 'precipitation,soil_moisture_0_to_7cm',
        past_hours: 72,
        forecast_hours: 1,
        timezone: 'UTC'
      },
      timeout: Number(process.env.WEATHER_TIMEOUT_MS) || 8000
    });
    const hourlyTimes = response.data?.hourly?.time;
    const result = {
      values: buildValues(response.data),
      dataTimestamp: Array.isArray(hourlyTimes) ? hourlyTimes.at(-1) || null : null,
      source: 'open-meteo',
      status: 'ok'
    };
    cache.set(key, result);
    return result;
  } catch (error) {
    return {
      values: {},
      dataTimestamp: null,
      source: 'open-meteo',
      status: 'unavailable',
      error: error.message
    };
  }
}

async function getWeatherFeaturesBatch(locations) {
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

  const BATCH_SIZE = 50;
  for (let i = 0; i < uncachedLocations.length; i += BATCH_SIZE) {
    const batchLocs = uncachedLocations.slice(i, i + BATCH_SIZE);
    const batchIndices = uncachedIndices.slice(i, i + BATCH_SIZE);
    
    const lats = batchLocs.map(l => l.latitude).join(',');
    const lons = batchLocs.map(l => l.longitude).join(',');

    try {
      const response = await axios.get(WEATHER_URL, {
        params: {
          latitude: lats,
          longitude: lons,
          hourly: 'precipitation,soil_moisture_0_to_7cm',
          past_hours: 72,
          forecast_hours: 1,
          timezone: 'UTC'
        },
        timeout: Number(process.env.WEATHER_TIMEOUT_MS) || 8000
      });

      const dataArray = Array.isArray(response.data) ? response.data : [response.data];

      for (let j = 0; j < dataArray.length; j++) {
        const data = dataArray[j];
        const hourlyTimes = data?.hourly?.time;
        const result = {
          values: buildValues(data),
          dataTimestamp: Array.isArray(hourlyTimes) ? hourlyTimes.at(-1) || null : null,
          source: 'open-meteo',
          status: 'ok'
        };
        const locIndex = batchIndices[j];
        const loc = locations[locIndex];
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
          source: 'open-meteo',
          status: 'unavailable',
          error: error.message
        };
      }
    }
  }

  return results;
}

module.exports = { getWeatherFeatures, getWeatherFeaturesBatch, buildValues };
