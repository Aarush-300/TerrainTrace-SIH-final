/**
 * Single source of truth for backend API configuration.
 * Change BASE_URL here (or via VITE_API_BASE env var) — never in components.
 */

export const BASE_URL = import.meta.env.VITE_API_BASE ?? '';

export const API = {
  risk: {
    predict:  `${BASE_URL}/api/risk/predict`,
    grid:     `${BASE_URL}/api/risk/grid`,
    viewport: `${BASE_URL}/api/risk/viewport`,
  },
  reports: {
    create:  `${BASE_URL}/api/reports`,
    list:    `${BASE_URL}/api/reports`,
  },
  health:    `${BASE_URL}/api/health`,
  stats:     `${BASE_URL}/api/stats`,
  landslides:`${BASE_URL}/api/landslides`,
  assets: {
    list: `${BASE_URL}/api/assets`,
    roads: `${BASE_URL}/api/assets/roads`,
  },
  safety: {
    zones: `${BASE_URL}/api/safety/zones`,
  },
  alerts: {
    list: `${BASE_URL}/api/v1/alerts`,
    create: `${BASE_URL}/api/v1/alerts`,
    feed: `${BASE_URL}/api/v1/alerts/feed.xml`,
  },
  routes: {
    triage: `${BASE_URL}/api/routes/triage`,
    find: `${BASE_URL}/api/routes/find`,
  },
  telemetry: {
    rainfall: `${BASE_URL}/api/telemetry/rainfall`,
  },
};
