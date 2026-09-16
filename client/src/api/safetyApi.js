import axios from 'axios';
import { API } from '../config/api.js';

export async function getHighRiskZones() {
  try {
    const { data } = await axios.get(API.safety.zones);
    return data;
  } catch {
    return [];
  }
}
