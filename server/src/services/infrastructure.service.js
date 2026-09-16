// Reserved adapter for roads, bridges, and critical-facility feeds. It is kept
// deliberately inert until an approved source is configured; absence is
// reported to the feature service rather than manufactured as a zero value.
async function getInfrastructureFeatures() {
  return {
    values: {},
    dataTimestamp: null,
    source: 'not-configured',
    status: 'unavailable'
  };
}

module.exports = { getInfrastructureFeatures };
