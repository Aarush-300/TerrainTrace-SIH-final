import React from 'react';
import StatusBadge from './StatusBadge.jsx';
import { getRiskClass } from '../types/risk.js';
import t from '../i18n/en.json';

const fmt = (v, digits = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'N/A';

/**
 * Human-readable label for known feature keys.
 * Unknown keys are title-cased automatically — no hard-coded requirement.
 */
const FEATURE_LABELS = {
  elevation_m:             `${t.elevation} (m)`,
  slope_deg:               `${t.slope} (°)`,
  rainfall_3d_mm:          `${t.rainfall3d} (mm)`,
  rainfall_24h_intensity:  `${t.rainfall24h} (mm/h)`,
  soil_moisture_pct:       `${t.soilMoisture} (%)`,
  fault_distance_m:        `${t.faultDistance} (km)`,
};

function featureLabel(key) {
  return FEATURE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function featureValue(key, raw) {
  if (raw == null) return 'N/A';
  // Convert fault distance from metres to km
  if (key === 'fault_distance_m') return fmt(raw / 1000, 2);
  if (typeof raw === 'number') return fmt(raw);
  return String(raw);
}

/**
 * RiskPanel — displays the full prediction returned by POST /api/risk/predict.
 *
 * Props:
 *   status:     'idle' | 'loading' | 'ok' | 'partial' | 'error' | 'offline'
 *   data:       prediction response object (or null)
 *   error:      error string (or null)
 *   staleAt:    ISO timestamp when cached data was last fetched (or null)
 */
const RiskPanel = ({ status = 'idle', data = null, error = null, staleAt = null }) => {
  if (status === 'idle') {
    return <div className="hint-text">{t.clickToAnalyze}</div>;
  }

  if (status === 'loading') {
    return <div className="hint-text">{t.analyzingLocation}</div>;
  }

  if (status === 'error' || (!data && status !== 'offline')) {
    return (
      <div className="prediction-error">
        <StatusBadge status="error" />
        <span style={{ marginLeft: 8 }}>{error || t.errorOccurred}</span>
      </div>
    );
  }

  if (!data) return null;

  const prob = data.probability;
  const probPct = prob != null ? `${(prob * 100).toFixed(1)}%` : 'N/A';
  const probBar = prob != null ? Math.round(prob * 100) : 0;
  const loc = data.location ?? {};
  const features = data.features ?? {};
  const isStale = status === 'offline' || status === 'stale';

  return (
    <div className="risk-panel">
      {/* Status row */}
      <div className="risk-panel-status-row">
        <StatusBadge status={isStale ? 'stale' : status} />
        {isStale && staleAt && (
          <span className="stale-label">
            {t.staleData} {new Date(staleAt).toLocaleTimeString()}
          </span>
        )}
        {data.model_version && (
          <span className="model-version">v{data.model_version}</span>
        )}
      </div>

      {/* Risk level */}
      <div className="prediction-heading">
        <strong>{t.riskLevel}</strong>
        <span className={`risk-badge ${getRiskClass(data.risk_level)}`}>
          {data.risk_level ?? t.unknown}
        </span>
      </div>

      {/* Probability bar */}
      <div className="prob-bar-label">
        {probPct} {t.likelihood}
      </div>
      <div className="prob-bar-track">
        <div className="prob-bar-fill" style={{ width: `${probBar}%` }} />
      </div>

      {/* Core scores */}
      <div className="prediction-grid">
        {data.risk_score != null && (
          <><span>{t.riskScore}</span><span>{fmt(data.risk_score, 3)}</span></>
        )}
        {data.confidence != null && (
          <><span>{t.confidence}</span><span>{(data.confidence * 100).toFixed(1)}%</span></>
        )}
        {loc.latitude != null && (
          <><span>{t.latitude}</span><span>{fmt(loc.latitude, 4)}</span></>
        )}
        {loc.longitude != null && (
          <><span>{t.longitude}</span><span>{fmt(loc.longitude, 4)}</span></>
        )}
        {data.data_timestamp && (
          <><span>{t.dataTimestamp}</span><span>{new Date(data.data_timestamp).toLocaleString()}</span></>
        )}
      </div>

      {/* Dynamic feature list — renders whatever the backend sends */}
      {Object.keys(features).length > 0 && (
        <>
          <div className="panel-divider" />
          <div className="prediction-grid">
            {Object.entries(features).map(([key, val]) => (
              <React.Fragment key={key}>
                <span>{featureLabel(key)}</span>
                <span>{featureValue(key, val)}</span>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* Partial data warning */}
      {data.status === 'partial' && (
        <div className="partial-warning">⚠ {t.partialData}</div>
      )}
    </div>
  );
};

export default RiskPanel;

