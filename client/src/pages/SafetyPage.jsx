import React, { useState, useEffect } from 'react';
import { getHighRiskZones } from '../api/safetyApi.js';
import { RISK_COLORS } from '../types/risk.js';
import en from '../i18n/en.json';

const t = en;

const SafetyAccordion = ({ level, color, actionsTitle, text }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div className={`safety-card ${level.toLowerCase()}`} style={{ borderLeftColor: color }}>
      <div className="safety-card-header" onClick={() => setOpen(!open)}>
        <span>{actionsTitle}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="safety-card-body">
          {text}
        </div>
      )}
    </div>
  );
};

export default function SafetyPage() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    getHighRiskZones().then(setZones).catch(() => {});
  }, []);

  return (
    <div className="page-container">
      <h1 className="page-title">{t.safetyPageTitle}</h1>

      <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: '#e0e0e0' }}>{t.activeHighRiskZones}</h3>
      <div className="risk-zones-grid">
        {zones.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>{t.noData}</p>}
        {zones.map(z => {
          const isCritical = z.riskScore >= 75;
          const color = isCritical ? RISK_COLORS.CRITICAL : RISK_COLORS.HIGH;
          const classN = isCritical ? 'critical' : 'high';
          return (
            <div key={z.id} className={`zone-card ${classN}`} style={{ borderLeftColor: color }}>
              <div className="zone-location">[{z.latitude.toFixed(4)}, {z.longitude.toFixed(4)}]</div>
              <div className="zone-score">
                {t.riskScore}: {z.riskScore}%
                <div className="score-bar">
                  <div className="score-bar-fill" style={{ width: `${z.riskScore}%`, backgroundColor: color }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ marginBottom: '1rem', color: '#e0e0e0' }}>{t.safetyMeasures}</h3>
      <div className="safety-accordion">
        <SafetyAccordion level="critical" color={RISK_COLORS.CRITICAL} actionsTitle={t.criticalActions} text={t.criticalSafety} />
        <SafetyAccordion level="high" color={RISK_COLORS.HIGH} actionsTitle={t.highActions} text={t.highSafety} />
        <SafetyAccordion level="moderate" color={RISK_COLORS.MODERATE} actionsTitle={t.moderateActions} text={t.moderateSafety} />
        <SafetyAccordion level="low" color={RISK_COLORS.LOW} actionsTitle={t.lowActions} text={t.lowSafety} />
      </div>

      <div className="emergency-contacts">
        <h3>{t.emergencyContacts}</h3>
        <div className="contact-item">
          <span>{t.ndrf}</span>
          <span style={{ fontWeight: 'bold', color: '#fff' }}>{t.ndrfNumber}</span>
        </div>
        <div className="contact-item">
          <span>{t.sdma}</span>
          <span>1070</span>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <a href="#" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.9rem' }}>📄 {t.downloadChecklist}</a>
        </div>
      </div>
    </div>
  );
}
