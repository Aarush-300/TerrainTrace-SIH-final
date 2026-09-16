const axios = require('axios');
const mongoose = require('mongoose');

async function health(_req, res) {
  const databaseReady = mongoose.connection.readyState === 1;
  const mlUrl = process.env.ML_SERVICE_URL || process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  let mlReady = false;
  try {
    const response = await axios.get(`${mlUrl}/health`, { timeout: 1500 });
    mlReady = response.data?.ready === true;
  } catch (_) {
    mlReady = false;
  }
  const status = mlReady ? (databaseReady ? 'ok' : 'degraded') : 'degraded';
  return res.status(mlReady ? 200 : 503).json({ status, ml_ready: mlReady, database_ready: databaseReady });
}

module.exports = { health };
