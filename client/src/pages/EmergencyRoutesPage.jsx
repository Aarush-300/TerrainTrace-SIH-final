import React, { useState, useEffect } from 'react';
import { getTriageTable, findRoute } from '../api/routesApi.js';
import en from '../i18n/en.json';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import L from 'leaflet';

const t = en;

export default function EmergencyRoutesPage() {
  const [triage, setTriage] = useState([]);
  const [routeForm, setRouteForm] = useState({ originLat: '', originLng: '', destLat: '', destLng: '' });
  const [routeResult, setRouteResult] = useState(null);

  useEffect(() => {
    getTriageTable().then(setTriage).catch(() => {});
  }, []);

  const handleRouteFormChange = (e) => {
    const { name, value } = e.target;
    setRouteForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFindRoute = async () => {
    const res = await findRoute(routeForm.originLat, routeForm.originLng, routeForm.destLat, routeForm.destLng);
    setRouteResult(res || { 
      path: [[parseFloat(routeForm.originLat), parseFloat(routeForm.originLng)], [parseFloat(routeForm.destLat), parseFloat(routeForm.destLng)]],
      blockedSegments: [],
      distance: 0,
      time: 0
    });
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t.routesPageTitle}</h1>
      
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#e0e0e0', marginBottom: '1rem' }}>{t.priorityTriage}</h3>
        <table className="triage-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Isolation (hours)</th>
            </tr>
          </thead>
          <tbody>
            {triage.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>{t.noBlockedRoads}</td></tr>
            )}
            {triage.map(row => (
              <tr key={row.id}>
                <td>{row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}</td>
                <td>{row.type}</td>
                <td>{row.severity}</td>
                <td style={{ color: row.isolationHours > 24 ? '#ef4444' : '#ccc' }}>{row.isolationHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="route-planner">
        <h3 style={{ color: '#e0e0e0', marginBottom: '1rem' }}>{t.routePlanner}</h3>
        <div className="route-inputs">
          <div className="form-label">
            {t.origin}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input type="number" step="any" name="originLat" className="form-input" placeholder="Lat" value={routeForm.originLat} onChange={handleRouteFormChange} />
              <input type="number" step="any" name="originLng" className="form-input" placeholder="Lng" value={routeForm.originLng} onChange={handleRouteFormChange} />
            </div>
          </div>
          <div className="form-label">
            {t.destination}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input type="number" step="any" name="destLat" className="form-input" placeholder="Lat" value={routeForm.destLat} onChange={handleRouteFormChange} />
              <input type="number" step="any" name="destLng" className="form-input" placeholder="Lng" value={routeForm.destLng} onChange={handleRouteFormChange} />
            </div>
          </div>
          <button className="refresh-btn" style={{ width: 'auto', margin: 0, padding: '0.6rem 1.5rem' }} onClick={handleFindRoute}>
            {t.findRoute}
          </button>
        </div>

        {routeResult && (
          <>
            <div className="route-info">
              <span><strong>Distance:</strong> {routeResult.distance} km</span>
              <span><strong>Est. Time:</strong> {routeResult.time} mins</span>
              {routeResult.blockedSegments && routeResult.blockedSegments.length > 0 && (
                <span style={{ color: '#ef4444' }}>⚠️ Blocked segments detected</span>
              )}
            </div>
            <div className="route-map">
              <MapContainer 
                center={routeResult.path[0]} 
                zoom={11} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Polyline positions={routeResult.path} color="#3b82f6" weight={5} />
                {routeResult.blockedSegments && routeResult.blockedSegments.map((seg, idx) => (
                  <Polyline key={idx} positions={seg} color="#ef4444" weight={5} dashArray="5, 10" />
                ))}
              </MapContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
