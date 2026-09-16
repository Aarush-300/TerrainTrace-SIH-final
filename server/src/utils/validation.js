const STUDY_AREA = {
  minLatitude: Number(process.env.MIN_LATITUDE) || 20,
  maxLatitude: Number(process.env.MAX_LATITUDE) || 35,
  minLongitude: Number(process.env.MIN_LONGITUDE) || 75,
  maxLongitude: Number(process.env.MAX_LONGITUDE) || 100
};

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseLocation(payload = {}) {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw validationError('latitude and longitude must be finite numbers');
  }
  if (latitude < STUDY_AREA.minLatitude || latitude > STUDY_AREA.maxLatitude ||
      longitude < STUDY_AREA.minLongitude || longitude > STUDY_AREA.maxLongitude) {
    throw validationError('location is outside the supported Northeast India study area');
  }

  let timestamp;
  if (payload.timestamp !== undefined) {
    timestamp = new Date(payload.timestamp);
    if (Number.isNaN(timestamp.getTime())) throw validationError('timestamp must be an ISO-8601 date');
    timestamp = timestamp.toISOString();
  }

  return { latitude, longitude, ...(timestamp ? { timestamp } : {}) };
}

module.exports = { STUDY_AREA, parseLocation, validationError };
