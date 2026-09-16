const featureConfig = require('./features.json');

function getEnabledFeatures() {
  return Object.entries(featureConfig)
    .filter(([, definition]) => definition.enabled)
    .map(([name, definition]) => ({ name, ...definition }));
}

module.exports = { featureConfig, getEnabledFeatures };
