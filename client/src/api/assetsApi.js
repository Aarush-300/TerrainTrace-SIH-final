import axios from 'axios';
import { API } from '../config/api.js';

export async function getVulnerableAssets(bounds) {
  try {
    const params = new URLSearchParams(bounds);
    const { data } = await axios.get(`${API.assets.list}?${params.toString()}`);
    return data;
  } catch {
    return [];
  }
}

export async function getRoadStatus(bounds) {
  try {
    const params = new URLSearchParams(bounds);
    const { data } = await axios.get(`${API.assets.roads}?${params.toString()}`);
    return data;
  } catch {
    return [];
  }
}
