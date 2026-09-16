import React from 'react';
import AlertList from './AlertList.jsx';
import RiskPanel from './RiskPanel.jsx';
import FieldReportForm from './FieldReportForm.jsx';
import t from '../i18n/en.json';

/**
 * Sidebar — layout shell only.
 * All render logic lives in the child components.
 *
 * Props:
 *   prediction:       object | null
 *   predictionStatus: 'idle' | 'loading' | 'ok' | 'partial' | 'error' | 'offline' | 'stale'
 *   predictionError:  string | null
 *   staleAt:          ISO timestamp string | null
 *   selectedLat:      number | null  (pre-fills report form)
 *   selectedLng:      number | null
 *   statsRefreshKey:  number (increment to re-fetch stats)
 *   fieldReports:     array
 *   onReportSubmitted: callback(id)
 */
const Sidebar = ({
  prediction,
  predictionStatus,
  predictionError,
  staleAt,
  selectedLat,
  selectedLng,
  statsRefreshKey,
  onReportSubmitted,
}) => (
  <div className="sidebar">
    <div className="sidebar-section">
      <h3>{t.dashboardStats}</h3>
      <AlertList refreshKey={statsRefreshKey} />
    </div>

    <div className="sidebar-section">
      <h3>{t.pointAnalysis}</h3>
      <RiskPanel
        status={predictionStatus}
        data={prediction}
        error={predictionError}
        staleAt={staleAt}
      />
    </div>

    <div className="sidebar-section">
      <h3>{t.fieldReports}</h3>
      <FieldReportForm
        defaultLat={selectedLat}
        defaultLng={selectedLng}
        onSubmitted={onReportSubmitted}
      />
    </div>
  </div>
);

export default Sidebar;
