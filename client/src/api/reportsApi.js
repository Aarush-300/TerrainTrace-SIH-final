/**
 * API layer for field report endpoints.
 * Components import from here — never call axios/fetch directly.
 */

import axios from 'axios';
import { API } from '../config/api.js';

/**
 * POST /api/reports
 * @param {{ latitude, longitude, type, description?, image_reference? }} data
 * @returns {Promise<{ id, status, reported_at }>}
 */
export async function submitReport(data) {
  const { data: result } = await axios.post(API.reports.create, data);
  return result;
}

/**
 * GET /api/reports
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
export async function getReports(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const { data } = await axios.get(`${API.reports.list}?${params.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function submitReportWithMedia(formData) {
  const { data } = await axios.post(API.reports.create, formData);
  return data;
}

export async function getReportById(id) {
  const { data } = await axios.get(`${API.reports.list}/${id}`);
  return data;
}

export async function updateReportStatus(id, status) {
  const { data } = await axios.patch(`${API.reports.list}/${id}/status`, { status });
  return data;
}

