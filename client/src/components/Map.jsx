import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
window.L = L;
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  CircleMarker,
  LayerGroup,
  LayersControl,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import RiskLegend from './RiskLegend.jsx';
import { getRiskColor, getRiskClass } from '../types/risk.js';
import t from '../i18n/en.json';

const { BaseLayer, Overlay } = LayersControl;

// ── Helpers ────────────────────────────────────────────────────────────

const fmt = (v, d = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : 'N/A';

const CORRIDOR_COLORS = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MODERATE: '#eab308',
  MEDIUM:   '#eab308',
};

const AREA_COLORS = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MODERATE: '#eab308',
  MEDIUM:   '#eab308',
};

// ── MapClickHandler ────────────────────────────────────────────────────

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({ click: (e) => onMapClick?.(e.latlng) });
  return null;
};

// ── LiveRiskLayer (handles viewport change events) ─────────────────────

const LiveRiskLayer = ({ onViewportChange }) => {
  const map = useMap();
  const timerRef = useRef(null);

  const fireViewportChange = useCallback(() => {
    if (!map || !onViewportChange) return;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    onViewportChange({
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east:  bounds.getEast(),
        west:  bounds.getWest(),
      },
      zoom,
    });
  }, [map, onViewportChange]);

  useMapEvents({
    moveend: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fireViewportChange, 300);
    },
  });

  // Initial viewport query
  useEffect(() => {
    const id = setTimeout(fireViewportChange, 500);
    return () => clearTimeout(id);
  }, [fireViewportChange]);

  return null;
};


// ── Map State Panner ───────────────────────────────────────────────────

const StatePanner = ({ selectedState }) => {
  const map = useMap();
  useEffect(() => {
    if (!selectedState || selectedState === 'All') {
      map.flyTo([25.5, 91.5], 6); // Default NE India center
      return;
    }
    
    // Rough coordinates for states
    const stateCoords = {
      'Assam': [26.2, 92.9],
      'Meghalaya': [25.4, 91.2],
      'Mizoram': [23.1, 92.9],
      'Nagaland': [26.1, 94.5],
      'Manipur': [24.6, 93.9],
      'Tripura': [23.9, 91.9],
      'Arunachal Pradesh': [28.2, 94.7],
      'Sikkim': [27.5, 88.5],
    };

    const coords = stateCoords[selectedState];
    if (coords) {
      map.flyTo(coords, 7);
    }
  }, [selectedState, map]);
  return null;
};

// ── Corridor Layer ─────────────────────────────────────────────────────

const CorridorLayer = ({ corridors }) => {
  if (!corridors || corridors.length === 0) return null;

  return (
    <LayerGroup>
      {corridors.map((corridor, i) => {
        const color = CORRIDOR_COLORS[corridor.riskLevel?.toUpperCase()] || '#f97316';
        return (
          <Polyline
            key={`corridor-${i}`}
            positions={corridor.coords}
            pathOptions={{
              color,
              weight: 3,
              opacity: 0.75,
              dashArray: '8, 6',
              lineCap: 'round',
            }}
          >
            <Tooltip sticky>
              Risk Corridor — {corridor.riskLevel} · Avg: {(corridor.avgProbability * 100).toFixed(1)}%
            </Tooltip>
          </Polyline>
        );
      })}
    </LayerGroup>
  );
};

// ── Risk Area Layer ────────────────────────────────────────────────────

const RiskAreaLayer = ({ areas }) => {
  if (!areas || areas.length === 0) return null;

  return (
    <LayerGroup>
      {areas.map((area, i) => {
        const color = AREA_COLORS[area.riskLevel?.toUpperCase()] || '#eab308';
        return (
          <Polygon
            key={`area-${i}`}
            positions={area.coords}
            pathOptions={{
              color,
              weight: 2,
              opacity: 0.5,
              fillColor: color,
              fillOpacity: 0.12,
            }}
          >
            <Tooltip sticky>
              Risk Area — {area.riskLevel} · {area.pointCount} points · Avg: {(area.avgProbability * 100).toFixed(1)}%
            </Tooltip>
          </Polygon>
        );
      })}
    </LayerGroup>
  );
};

// ── Loading Indicator ──────────────────────────────────────────────────

const LiveRiskLoadingIndicator = ({ loading }) => {
  if (!loading) return null;
  return <div className="live-risk-loading">⏳ Fetching live risk data…</div>;
};

// ── Clustered Risk Layer ───────────────────────────────────────────────

/**
 * Imperatively manages a MarkerClusterGroup for live risk points.
 * Uses Leaflet's native L.markerClusterGroup instead of 400+ React
 * CircleMarker components — dramatically faster add/remove/cluster.
 */
const ClusteredRiskLayer = ({ liveRiskPoints, onPointClick }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // Create or clear the cluster group
    if (clusterGroupRef.current) {
      clusterGroupRef.current.clearLayers();
    } else {
      clusterGroupRef.current = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        chunkedLoading: true,
        disableClusteringAtZoom: 12,
      });
      map.addLayer(clusterGroupRef.current);
    }

    // Build all markers as native Leaflet layers
    const markers = [];
    for (const zone of liveRiskPoints) {
      const riskLevel = (zone.properties?.riskLevel || zone.riskLevel || 'UNKNOWN').toUpperCase();
      if (riskLevel === 'LOW' || riskLevel === 'UNKNOWN' || riskLevel.includes('PARTIAL')) continue;

      const lat = parseFloat(zone.properties?.center_lat || zone.lat || zone.latitude);
      const lng = parseFloat(zone.properties?.center_lng || zone.lon || zone.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const color = getRiskColor(riskLevel);
      const prob = ((zone.properties?.probability ?? zone.probability) || 0) * 100;

      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.8,
      });

      marker.bindTooltip(
        `Risk: ${zone.properties?.riskLevel || zone.riskLevel || 'UNKNOWN'}<br/>Prob: ${fmt(prob)}%`,
        { sticky: true }
      );

      marker.on('click', (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        if (onPointClick) onPointClick(zone.properties || zone);
      });

      markers.push(marker);
    }

    // Bulk-add all markers at once (much faster than adding one by one)
    clusterGroupRef.current.addLayers(markers);

    return () => {
      if (clusterGroupRef.current) {
        clusterGroupRef.current.clearLayers();
      }
    };
  }, [map, liveRiskPoints, onPointClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clusterGroupRef.current && map) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  return null;
};

// ── Main Map Component ─────────────────────────────────────────────────

/**
 * Map — Live GIS map of Northeast India with advanced visualization.
 *
 * Props:
 *   liveRiskPoints:  array of GeoJSON Point features from /api/risk/viewport
 *   corridors:       array from buildCorridors()
 *   riskAreas:       array from buildRiskAreas()
 *   liveLoading:     boolean
 *   landslides:      array of historical landslide objects
 *   fieldReports:    array of submitted field report objects
 *   onPointClick(properties): called when a live risk point is clicked
 *   onMapClick({ lat, lng }): called when bare map is clicked
 *   onViewportChange({ bounds, zoom }): called on pan/zoom (debounced)
 */
const Map = ({
  liveRiskPoints = [],
  corridors = [],
  riskAreas = [],
  liveLoading = false,
  landslides = [],
  fieldReports = [],
  selectedState = 'All',
  onPointClick,
  onMapClick,
  onViewportChange,
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LiveRiskLoadingIndicator loading={liveLoading} />

      <MapContainer center={[25.5, 91.5]} zoom={6} maxZoom={18} style={{ height: '80vh', width: '100%' }}>
        <StatePanner selectedState={selectedState} />
        <MapClickHandler onMapClick={onMapClick} />
        <LiveRiskLayer onViewportChange={onViewportChange} />
        <ClusteredRiskLayer liveRiskPoints={liveRiskPoints} onPointClick={onPointClick} />

        <LayersControl position="topright">
          {/* ── Base Layers ──────────────────────────────── */}
          <BaseLayer checked name={t.streetMap}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name={t.satellite}>
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>

          {/* ── Risk Corridors ────────────────────────────── */}
          <Overlay name={t.riskCorridors}>
            <CorridorLayer corridors={corridors} />
          </Overlay>

          {/* ── Risk Areas ────────────────────────────────── */}
          <Overlay name={t.riskAreas}>
            <RiskAreaLayer areas={riskAreas} />
          </Overlay>

          {/* ── Historical Landslides ─────────────────────── */}
          <Overlay checked name={t.historicalLandslides}>
            <LayerGroup>
              {landslides.map((slide, i) => (
                <CircleMarker
                  key={slide._id ?? i}
                  center={[slide.latitude, slide.longitude]}
                  radius={5}
                  pathOptions={{ color: '#ff6b6b', fillColor: '#ff6b6b', fillOpacity: 0.7, weight: 1 }}
                  eventHandlers={{
                    click: (e) => { if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div className="popup-title">{slide.event_title || 'Landslide Event'}</div>
                      <div className="popup-detail"><span>Date</span><span>{slide.event_date ? new Date(slide.event_date).toLocaleDateString() : 'N/A'}</span></div>
                      <div className="popup-detail"><span>Category</span><span>{slide.landslide_category || 'N/A'}</span></div>
                      <div className="popup-detail"><span>Trigger</span><span>{slide.landslide_trigger || 'N/A'}</span></div>
                      <div className="popup-detail"><span>Fatalities</span><span>{slide.fatality_count ?? 0}</span></div>
                      <div className="popup-detail"><span>Location</span><span style={{ textAlign: 'right', maxWidth: 120 }}>{slide.location_description || 'N/A'}</span></div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </LayerGroup>
          </Overlay>

          {/* ── Citizen Reports ───────────────────────────── */}
          {fieldReports.length > 0 && (
            <Overlay checked name={t.citizenReports}>
              <LayerGroup>
                {fieldReports.map((r, i) => (
                  <CircleMarker
                    key={r.id ?? i}
                    center={[r.latitude, r.longitude]}
                    radius={6}
                    pathOptions={{ color: '#a855f7', fillColor: '#a855f7', fillOpacity: 0.85, weight: 2 }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <div className="popup-title">{r.type?.replace(/_/g, ' ')}</div>
                        {r.description && <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{r.description}</div>}
                        <div className="popup-detail"><span>Reported</span><span>{r.reported_at ? new Date(r.reported_at).toLocaleString() : 'N/A'}</span></div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </LayerGroup>
            </Overlay>
          )}

          {/* ── Road Connectivity ─────────────────────────── */}
          <Overlay name={t.roadConnectivity || 'Road Connectivity'}>
            <LayerGroup>
              {/* Fetched from /api/assets/roads dynamically on toggle */}
            </LayerGroup>
          </Overlay>

          {/* ── Vulnerable Assets ─────────────────────────── */}
          <Overlay name={t.vulnerableAssets || 'Vulnerable Assets'}>
            <LayerGroup>
              {/* Fetched from /api/assets dynamically on toggle */}
            </LayerGroup>
          </Overlay>

          {/* ── Rainfall Overlay ──────────────────────────── */}
          <Overlay name={t.rainfallOverlay || 'Rainfall Overlay'}>
            <TileLayer
              url="https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=placeholder"
            />
          </Overlay>
        </LayersControl>

        <RiskLegend />
      </MapContainer>
    </div>
  );
};

export default Map;
