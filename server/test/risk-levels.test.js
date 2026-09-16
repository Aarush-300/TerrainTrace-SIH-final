const test = require('node:test');
const assert = require('node:assert/strict');
const { getRiskLevel } = require('../src/utils/risk-levels');

test('risk levels use the configured inclusive thresholds', () => {
  assert.equal(getRiskLevel(0), 'LOW');
  assert.equal(getRiskLevel(0.39), 'LOW');
  assert.equal(getRiskLevel(0.4), 'MODERATE');
  assert.equal(getRiskLevel(0.6), 'HIGH');
  assert.equal(getRiskLevel(0.8), 'CRITICAL');
  assert.equal(getRiskLevel(1), 'CRITICAL');
});

test('risk levels reject invalid model output', () => {
  assert.throws(() => getRiskLevel(-0.01));
  assert.throws(() => getRiskLevel(1.01));
});
