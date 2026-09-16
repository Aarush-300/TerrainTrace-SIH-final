/**
 * API layer for risk prediction endpoints.
 * Components import from here — never call axios/fetch directly.
 */

import axios from 'axios';
import { API } from '../config/api.js';

/**
 * POST /api/risk/predict
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<object>} Normalized prediction response
 */
export async function predictRisk(latitude, longitude) {
  try {
    const { data } = await axios.post(API.risk.predict, { latitude, longitude });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 424) {
      // 424 means partial data (missing features from upstream), which the UI can render
      return err.response.data;
    }
    throw err;
  }
}

/**
 * POST /api/risk/viewport
 * @param {{ north: number, south: number, east: number, west: number }} bounds
 * @param {number} zoom
 * @param {string} riskHorizon
 * @returns {Promise<object>} GeoJSON FeatureCollection of Point features
 */
export async function getViewportRisk(bounds, zoom, riskHorizon = 'nowcast') {
  const { data } = await axios.post(API.risk.viewport, { bounds, zoom, riskHorizon });
  return data;
}

/**
 * GET /api/risk/grid  (kept for stats / legacy consumers)
 * @returns {Promise<object>} GeoJSON FeatureCollection
 */
export async function getRiskGrid() {
  const { data } = await axios.get(API.risk.grid);
  return data;
}

/**
 * GET /api/health
 * @returns {Promise<object>}
 */
export async function getHealth() {
  const { data } = await axios.get(API.health);
  return data;
}

/**
 * GET /api/stats
 * @returns {Promise<object>}
 */
export async function getStats() {
  const { data } = await axios.get(API.stats);
  return data;
}

/**
 * GET /api/landslides
 * @returns {Promise<Array>}
 */
export async function getLandslides() {
  const { data } = await axios.get(API.landslides);
  return Array.isArray(data) ? data : [];
}
