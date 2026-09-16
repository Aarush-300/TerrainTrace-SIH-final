import axios from 'axios';
import { API } from '../config/api.js';

export async function getAlerts(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const { data } = await axios.get(`${API.alerts.list}?${params.toString()}`);
    return data;
  } catch {
    return [];
  }
}

export async function createAlert(payload) {
  const { data } = await axios.post(API.alerts.create, payload);
  return data;
}

export async function getAlertFeed() {
  try {
    const { data } = await axios.get(API.alerts.feed, { responseType: 'text' });
    return data;
  } catch {
    return null;
  }
}
