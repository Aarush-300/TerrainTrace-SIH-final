const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLocation } = require('../src/utils/validation');

test('accepts a Northeast India location and an optional timestamp', () => {
  assert.deepEqual(parseLocation({ latitude: 25.57, longitude: 91.88, timestamp: '2026-01-01T00:00:00Z' }), {
    latitude: 25.57,
    longitude: 91.88,
    timestamp: '2026-01-01T00:00:00.000Z'
  });
});

test('rejects invalid or out-of-area locations', () => {
  assert.throws(() => parseLocation({ latitude: 'not-a-number', longitude: 91.88 }));
  assert.throws(() => parseLocation({ latitude: 18, longitude: 91.88 }));
});
