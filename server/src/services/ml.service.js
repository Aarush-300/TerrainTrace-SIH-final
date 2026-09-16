const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

class MlServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MlServiceError';
    this.status = status;
  }
}

async function predict(features) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, { features }, {
      timeout: Number(process.env.ML_TIMEOUT_MS) || 30000
    });
    const { probability, risk_score: riskScore, confidence, model_version: modelVersion } = response.data || {};
    if (![probability, riskScore, confidence].every(Number.isFinite) || typeof modelVersion !== 'string') {
      throw new MlServiceError('ML service returned an invalid prediction payload');
    }
    return { probability, riskScore, confidence, modelVersion };
  } catch (error) {
    if (error instanceof MlServiceError) throw error;
    const message = error.response?.data?.error || error.message || 'ML service is unavailable';
    throw new MlServiceError(message, error.response?.status && error.response.status < 500 ? error.response.status : 502);
  }
}

async function predictBatch(featuresList) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict_batch`, { points: featuresList.map(f => ({ features: f })) }, {
      timeout: Number(process.env.ML_TIMEOUT_MS) || 60000
    });
    const results = response.data?.results;
    if (!Array.isArray(results)) {
      throw new MlServiceError('ML service returned an invalid batch prediction payload');
    }
    return results.map(res => {
      const { probability, risk_score: riskScore, confidence, model_version: modelVersion } = res || {};
      if (![probability, riskScore, confidence].every(Number.isFinite) || typeof modelVersion !== 'string') {
        throw new MlServiceError('ML service returned an invalid prediction in batch payload');
      }
      return { probability, riskScore, confidence, modelVersion };
    });
  } catch (error) {
    if (error instanceof MlServiceError) throw error;
    
    console.error('[ML Service] predictBatch failed:', error.message);
    if (error.response?.data) {
      console.error('[ML Service] Error details from Python:', error.response.data);
    }
    
    const message = error.response?.data?.error || error.message || 'ML service is unavailable';
    throw new MlServiceError(message, error.response?.status && error.response.status < 500 ? error.response.status : 502);
  }
}

module.exports = { predict, predictBatch, MlServiceError };
