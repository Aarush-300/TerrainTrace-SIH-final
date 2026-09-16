import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { RISK_COLORS } from '../types/risk.js';
import t from '../i18n/en.json';

/** Leaflet DOM control legend with point, corridor, and area symbols. */
const RiskLegend = () => {
  const map = useMap();

  useEffect(() => {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>${t.riskLevels}</h4>
        <div class="legend-item">
          <span class="legend-color" style="background:${RISK_COLORS.CRITICAL};border-radius:50%"></span>${t.criticalRisk}
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background:${RISK_COLORS.HIGH};border-radius:50%"></span>${t.highRisk}
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background:${RISK_COLORS.MEDIUM};border-radius:50%"></span>${t.mediumRisk}
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background:${RISK_COLORS.LOW};border-radius:50%"></span>${t.lowRisk}
        </div>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.15);margin:8px 0"/>
        <div class="legend-item">
          <span class="legend-line" style="border-top:3px dashed ${RISK_COLORS.CRITICAL}"></span>${t.riskCorridors}
        </div>
        <div class="legend-item">
          <span class="legend-area" style="background:${RISK_COLORS.HIGH};opacity:0.25"></span>${t.riskAreas}
        </div>
      `;
      return div;
    };
    legend.addTo(map);
    return () => legend.remove();
  }, [map]);

  return null;
};

export default RiskLegend;
