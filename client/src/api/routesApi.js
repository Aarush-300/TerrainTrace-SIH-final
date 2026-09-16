import axios from 'axios';
import { API } from '../config/api.js';

export async function getTriageTable() {
  try {
    const { data } = await axios.get(API.routes.triage);
    return data;
  } catch {
    return [];
  }
}

export async function findRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const params = new URLSearchParams({
      from: `${fromLat},${fromLng}`,
      to: `${toLat},${toLng}`
    });
    const { data } = await axios.get(`${API.routes.find}?${params.toString()}`);
    return data;
  } catch {
    return null;
  }
}
