const { levels } = require('../config/risk-levels.json');

function getRiskLevel(probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Model returned an invalid probability');
  }
  const match = levels.find(({ max_probability: max }) => probability <= max);
  if (!match) throw new Error('Risk thresholds do not cover the model probability');
  return match.level;
}

module.exports = { levels, getRiskLevel };
