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

module.exports = { getWeatherFeatures, buildValues };
