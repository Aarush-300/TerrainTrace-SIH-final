/**
 * Shared risk-level constants and helpers.
 * Import from here — never duplicate in components.
 */

export const RISK_COLORS = {
  LOW:      '#22c55e',
  MODERATE: '#eab308',
  MEDIUM:   '#eab308',
  HIGH:     '#f97316',
  CRITICAL: '#ef4444',
  DEFAULT:  '#888888',
};

/** Map a risk_level string (any case) to its display color. */
export function getRiskColor(level) {
  return RISK_COLORS[(level || '').toUpperCase()] ?? RISK_COLORS.DEFAULT;
}

/** CSS class suffix used by existing .risk-badge.* rules. */
export function getRiskClass(level) {
  return (level || 'unknown').toLowerCase();
}

/** Report types accepted by POST /api/reports. */
export const REPORT_TYPES = [
  'CRACK',
  'SLOPE_MOVEMENT',
  'LANDSLIDE',
  'ROCKFALL',
  'ROAD_BLOCKAGE',
  'OTHER',
];

