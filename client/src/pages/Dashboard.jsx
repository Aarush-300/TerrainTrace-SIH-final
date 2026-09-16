import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map from '../components/Map.jsx';
import Sidebar from '../components/Sidebar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EarlyWarningBanner from '../components/EarlyWarningBanner.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { predictRisk, getLandslides, getViewportRisk } from '../api/riskApi.js';
import { buildCorridors, buildRiskAreas } from '../utils/geoUtils.js';
import t from '../i18n/en.json';

/** Lightweight hook: tracks online/offline state. */
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

const Dashboard = () => {
  const online = useOnlineStatus();
  
  const [riskHorizon, setRiskHorizon] = useState('nowcast');
  const [selectedState, setSelectedState] = useState('All');

  // ── Historical landslides (fetched once on mount) ──────────────────────
  const [landslides,     setLandslides]     = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getLandslides()
      .then((slides) => { if (active) setLandslides(slides); })
      .catch(console.error)
      .finally(() => { if (active) setInitialLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Live risk points (fetched on viewport change) ──────────────────────
  const [liveRiskPoints, setLiveRiskPoints] = useState([]);
  const [liveLoading,    setLiveLoading]    = useState(false);
  const viewportReqRef = useRef(0);
  
  const lastBounds = useRef(null);
  const lastZoom = useRef(null);

  const fetchViewportRisk = useCallback(async (bounds, zoom, horizon) => {
    if (!online) return;
    const id = ++viewportReqRef.current;
    setLiveLoading(true);

    try {
      const result = await getViewportRisk(bounds, zoom, horizon);
      if (id !== viewportReqRef.current) return;

      setLiveRiskPoints((prev) => {
        const map = new window.Map();
        for (const pt of prev) {
          const key = `${pt.properties.center_lat},${pt.properties.center_lng}`;
          map.set(key, pt);
        }
        for (const pt of result.features || []) {
          const key = `${pt.properties.center_lat},${pt.properties.center_lng}`;
          map.set(key, pt);
        }
        return Array.from(map.values());
      });
    } catch (err) {
      console.error('[Dashboard] Viewport risk fetch failed:', err);
    } finally {
      if (id === viewportReqRef.current) setLiveLoading(false);
    }
  }, [online]);

  const handleViewportChange = useCallback(({ bounds, zoom }) => {
    lastBounds.current = bounds;
    lastZoom.current = zoom;
    fetchViewportRisk(bounds, zoom, riskHorizon);
  }, [fetchViewportRisk, riskHorizon]);

  useEffect(() => {
    if (lastBounds.current && lastZoom.current) {
      fetchViewportRisk(lastBounds.current, lastZoom.current, riskHorizon);
    }
  }, [riskHorizon, fetchViewportRisk]);

  // ── Derived layers: corridors & risk areas (memoized) ──────────────────
  const corridors = useMemo(
    () => buildCorridors(liveRiskPoints, 30),
    [liveRiskPoints]
  );

  const riskAreas = useMemo(
    () => buildRiskAreas(liveRiskPoints, 12, 3),
    [liveRiskPoints]
  );

  // ── Point prediction (on map click) ────────────────────────────────────
  const [prediction,       setPrediction]       = useState(null);
  const [predictionStatus, setPredictionStatus] = useState('idle');
  const [predictionError,  setPredictionError]  = useState(null);
  const [staleAt,          setStaleAt]          = useState(null);
  const [selectedLat,      setSelectedLat]      = useState(null);
  const [selectedLng,      setSelectedLng]      = useState(null);
  const reqRef = useRef(0);
  const ignoreMapClick = useRef(false);

  const handleMapClick = useCallback(async ({ lat, lng }) => {
    if (ignoreMapClick.current) return;
    
    const id = ++reqRef.current;
    setSelectedLat(lat);
    setSelectedLng(lng);
    setPredictionStatus('loading');
    setPredictionError(null);

    if (!online) {
      setPredictionStatus('offline');
      return;
    }

    try {
      const data = await predictRisk(lat, lng);
      if (id !== reqRef.current) return;
      setPrediction(data);
      setStaleAt(new Date().toISOString());
      setPredictionStatus(data.status === 'partial' ? 'partial' : 'ok');
    } catch (err) {
      if (id !== reqRef.current) return;
      setPredictionError(err?.response?.data?.error || t.errorOccurred);
      setPredictionStatus('error');
    }
  }, [online]);

  // ── Risk point click (populates sidebar) ───────────────────────────────
  const handlePointClick = useCallback((properties) => {
    ignoreMapClick.current = true;
    setTimeout(() => { ignoreMapClick.current = false; }, 100);

    setPrediction({
      status:       'ok',
      risk_level:   properties.riskLevel,
      probability:  properties.probability,
      risk_score:   properties.risk_score,
      confidence:   properties.confidence,
      location:     { latitude: properties.center_lat, longitude: properties.center_lng },
      features: {
        elevation_m:            properties.elevation_m,
        slope_deg:              properties.slope_deg,
        rainfall_3d_mm:         properties.rainfall_3d_mm,
        rainfall_24h_intensity: properties.rainfall_24h_intensity,
        soil_moisture_pct:      properties.soil_moisture_pct,
        fault_distance_m:       properties.fault_distance_m,
      },
      data_timestamp: properties.computedAt,
    });
    setSelectedLat(properties.center_lat);
    setSelectedLng(properties.center_lng);
    setPredictionStatus('ok');
    setPredictionError(null);
  }, []);

  // ── Field reports ──────────────────────────────────────────────────────
  const [fieldReports,    setFieldReports]    = useState([]);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const handleReportSubmitted = useCallback((id) => {
    setFieldReports(prev => [...prev, {
      id,
      latitude:    selectedLat,
      longitude:   selectedLng,
      reported_at: new Date().toISOString(),
    }]);
    setStatsRefreshKey(k => k + 1);
  }, [selectedLat, selectedLng]);

  return (
    <div className="app-container">
      <LoadingSpinner loading={initialLoading} message={t.loading} />

      <header className="header">
        <span>{t.appTitle}</span>
        <div className="header-right">
          <StatusBadge status={online ? 'ok' : 'offline'} label={online ? t.online : t.offline} />
        </div>
      </header>

      <EarlyWarningBanner liveRiskPoints={liveRiskPoints} />
      <FilterBar riskHorizon={riskHorizon} setRiskHorizon={setRiskHorizon} selectedState={selectedState} setSelectedState={setSelectedState} />

      <div className="main-layout">
        <Sidebar
          prediction={prediction}
          predictionStatus={predictionStatus}
          predictionError={predictionError}
          staleAt={staleAt}
          selectedLat={selectedLat}
          selectedLng={selectedLng}
          statsRefreshKey={statsRefreshKey}
          onReportSubmitted={handleReportSubmitted}
        />

        <div className="map-container-wrapper">
          <Map
            liveRiskPoints={liveRiskPoints}
            corridors={corridors}
            riskAreas={riskAreas}
            liveLoading={liveLoading}
            landslides={landslides}
            fieldReports={fieldReports}
            selectedState={selectedState}
            onPointClick={handlePointClick}
            onMapClick={handleMapClick}
            onViewportChange={handleViewportChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
