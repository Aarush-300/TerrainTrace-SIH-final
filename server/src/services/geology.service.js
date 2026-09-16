const axios = require('axios');
const { TtlCache } = require('../utils/cache');

const lithologyCache = new TtlCache(Number(process.env.GEOLOGY_CACHE_TTL_MS) || 7 * 24 * 60 * 60 * 1000);
const LITHOLOGY_URL = process.env.LITHOLOGY_URL || 'https://macrostrat.org/api/v2/geologic_units/map';
const FAULTS_URL = process.env.FAULTS_URL || 'https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults.geojson';
let faultSegmentsPromise;

function cacheKey({ latitude, longitude }) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function collectLineStrings(geometry, result = []) {
  if (!geometry) return result;
  if (geometry.type === 'LineString') result.push(geometry.coordinates);
  if (geometry.type === 'MultiLineString') result.push(...geometry.coordinates);
  if (geometry.type === 'GeometryCollection') geometry.geometries.forEach((item) => collectLineStrings(item, result));
  return result;
}

function toLocalMetres([longitude, latitude], origin) {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(origin.latitude * Math.PI / 180);
  return [(longitude - origin.longitude) * longitudeScale, (latitude - origin.latitude) * latitudeScale];
}

function pointToSegmentDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const position = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx ** 2 + dy ** 2)));
  return Math.hypot(point[0] - (start[0] + position * dx), point[1] - (start[1] + position * dy));
}

async function getFaultSegments() {
  if (!faultSegmentsPromise) {
    faultSegmentsPromise = axios.get(FAULTS_URL, { timeout: Number(process.env.FAULTS_TIMEOUT_MS) || 20000 })
      .then(({ data }) => (data?.features || []).flatMap((feature) => collectLineStrings(feature.geometry)))
      .catch((error) => {
        faultSegmentsPromise = undefined;
        throw error;
      });
  }
  return faultSegmentsPromise;
}

function distanceToFault(location, lines) {
  const point = [0, 0];
  let nearest = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const start = toLocalMetres(line[index - 1], location);
      const end = toLocalMetres(line[index], location);
      nearest = Math.min(nearest, pointToSegmentDistance(point, start, end));
    }
  }
  return Number.isFinite(nearest) ? nearest : undefined;
}

async function getLithology(location) {
  const key = cacheKey(location);
  const cached = lithologyCache.get(key);
  if (cached !== undefined) return cached;
  const response = await axios.get(LITHOLOGY_URL, {
    params: { lat: location.latitude, lng: location.longitude },
    timeout: Number(process.env.GEOLOGY_TIMEOUT_MS) || 8000
  });
  const lithology = response.data?.success?.data?.[0]?.lith;
  const value = typeof lithology === 'string' && lithology.trim() ? lithology.trim().toLowerCase() : undefined;
  lithologyCache.set(key, value);
  return value;
}

async function getGeologyFeatures(location, requestedDefinitions) {
  const requested = new Set(requestedDefinitions.map(({ provider_key: key }) => key));
  const values = {};
  const errors = [];

  await Promise.all([
    requested.has('lithology')
      ? getLithology(location).then((value) => { values.lithology = value; }).catch((error) => errors.push(`lithology: ${error.message}`))
      : Promise.resolve(),
    requested.has('fault_distance')
      ? getFaultSegments().then((lines) => { values.fault_distance = distanceToFault(location, lines); }).catch((error) => errors.push(`faults: ${error.message}`))
      : Promise.resolve()
  ]);

  return {
    values,
    dataTimestamp: null,
    source: 'macrostrat/gem-active-faults',
    status: errors.length ? (Object.values(values).some((value) => value !== undefined) ? 'partial' : 'unavailable') : 'ok',
    ...(errors.length ? { error: errors.join('; ') } : {})
  };
}

module.exports = { getGeologyFeatures, distanceToFault, pointToSegmentDistance };
