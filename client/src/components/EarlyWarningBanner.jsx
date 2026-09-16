import React from 'react';

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MODERATE: 2, MEDIUM: 2, LOW: 1 };

/**
 * EarlyWarningBanner — dynamic alert banner derived from live risk data.
 *
 * Props:
 *   liveRiskPoints: array of GeoJSON Point features
 */
const EarlyWarningBanner = ({ liveRiskPoints = [] }) => {
  const critical = liveRiskPoints.filter(
    (f) => (f.properties?.riskLevel || '').toUpperCase() === 'CRITICAL'
  ).length;
  const high = liveRiskPoints.filter(
    (f) => (f.properties?.riskLevel || '').toUpperCase() === 'HIGH'
  ).length;

  if (critical === 0 && high === 0) return null;

  const level = critical > 0 ? 'critical' : 'high';

  return (
    <div className={`early-warning-banner early-warning-banner--${level}`}>
      <span className="early-warning-banner__icon">⚠</span>
      <span className="early-warning-banner__text">
        <strong>EARLY WARNING:</strong>
        {critical > 0 && ` ${critical} Critical`}
        {critical > 0 && high > 0 && ','}
        {high > 0 && ` ${high} High Risk`}
        {' '}zone{(critical + high) !== 1 ? 's' : ''} detected in current view
      </span>
    </div>
  );
};

export default EarlyWarningBanner;
