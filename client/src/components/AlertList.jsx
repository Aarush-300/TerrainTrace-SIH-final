import React, { useEffect, useState } from 'react';
import { getStats } from '../api/riskApi.js';
import StatusBadge from './StatusBadge.jsx';
import t from '../i18n/en.json';

const LEVEL_ORDER = ['Critical', 'High', 'Medium', 'Low'];

/**
 * AlertList — shows a summary of current risk zones and historical landslides.
 * Fetches /api/stats on mount; refreshes when `refreshKey` changes.
 */
const AlertList = ({ refreshKey = 0 }) => {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getStats()
      .then(data => { if (active) { setStats(data); setStatus('ok'); } })
      .catch(() => { if (active) setStatus(navigator.onLine ? 'error' : 'offline'); });
    return () => { active = false; };
  }, [refreshKey]);

  if (status === 'loading') return <div className="hint-text">{t.loading}</div>;

  if (!stats) {
    return (
      <div className="prediction-error">
        <StatusBadge status={status} />
        <span style={{ marginLeft: 8 }}>{t.errorOccurred}</span>
      </div>
    );
  }

  const byRisk = stats.riskZonesCount ?? {};
  const total = Object.values(byRisk).reduce((s, n) => s + n, 0);

  return (
    <div className="alert-list">
      <div className="stat-card">
        <div className="stat-card-title">{t.totalZones}</div>
        <div className="stat-card-value">{total}</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-title">{t.zonesByLevel}</div>
        <div className="badges-container" style={{ marginTop: 8 }}>
          {LEVEL_ORDER.map(lvl => (
            byRisk[lvl] != null && (
              <span key={lvl} className={`risk-badge ${lvl.toLowerCase()}`}>
                {lvl}: {byRisk[lvl]}
              </span>
            )
          ))}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-title">{t.totalLandslides}</div>
        <div className="stat-card-value">{stats.totalLandslides ?? 0}</div>
      </div>

      {stats.lastComputedTimestamp && (
        <div className="hint-text last-updated">
          {t.lastUpdated}:{' '}
          {new Date(stats.lastComputedTimestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default AlertList;

