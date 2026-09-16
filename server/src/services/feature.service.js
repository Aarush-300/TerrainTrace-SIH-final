const { getEnabledFeatures } = require('../config/features');
const { getWeatherFeatures } = require('./weather.service');
const { getTerrainFeatures } = require('./terrain.service');
const { getGeologyFeatures } = require('./geology.service');
const { getInfrastructureFeatures } = require('./infrastructure.service');

const providers = {
  weather: (location) => getWeatherFeatures(location),
  terrain: (location) => getTerrainFeatures(location),
  geology: (location, definitions) => getGeologyFeatures(location, definitions),
  infrastructure: (location) => getInfrastructureFeatures(location)
};

function isAvailable(value) {
  return (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.trim().length > 0);
}

function latestTimestamp(timestamps) {
  const valid = timestamps
    .map((timestamp) => ({ timestamp, date: new Date(timestamp) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return valid.sort((left, right) => right.date - left.date)[0].timestamp;
}

async function collectFeatures(location, { featureDefinitions = getEnabledFeatures(), sourceProviders = providers } = {}) {
  const bySource = featureDefinitions.reduce((groups, definition) => {
    (groups[definition.source] ||= []).push(definition);
    return groups;
  }, {});

  const results = await Promise.all(Object.entries(bySource).map(async ([source, definitions]) => {
    const provider = sourceProviders[source];
    if (!provider) {
      return [source, { values: {}, status: 'unavailable', source: 'not-configured', dataTimestamp: null }];
    }
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), 5000));
      const result = await Promise.race([provider(location, definitions), timeoutPromise]);
      return [source, result];
    } catch (error) {
      return [source, { values: {}, status: 'unavailable', source, dataTimestamp: null, error: error.message }];
    }
  }));

  const providerResults = Object.fromEntries(results);
  const features = {};
  const missingFeatures = [];
  const providerStatus = {};

  for (const definition of featureDefinitions) {
    const providerResult = providerResults[definition.source] || { values: {}, status: 'unavailable' };
    const value = providerResult.values?.[definition.provider_key];
    if (isAvailable(value)) features[definition.name] = value;
    else missingFeatures.push(definition.name);
  }

  for (const [source, result] of Object.entries(providerResults)) {
    // Keep diagnostic transport/provider errors in server logs. The public API
    // only needs a stable availability signal, not upstream implementation
    // details or network topology.
    providerStatus[source] = result.status;
  }

  return {
    features,
    missingFeatures,
    requiredMissingFeatures: missingFeatures.filter((name) => featureDefinitions.find((definition) => definition.name === name)?.required_for_prediction),
    providerStatus,
    dataTimestamp: latestTimestamp(Object.values(providerResults).map(({ dataTimestamp }) => dataTimestamp))
  };
}

module.exports = { collectFeatures, isAvailable, latestTimestamp };
