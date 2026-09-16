import React from 'react';
import en from '../i18n/en.json';

const t = en;

export default function FilterBar({ selectedState, setSelectedState, riskHorizon, setRiskHorizon }) {
  const states = ['All', 'Assam', 'Meghalaya', 'Mizoram', 'Nagaland', 'Manipur', 'Tripura', 'Arunachal Pradesh', 'Sikkim'];

  return (
    <div className="filter-bar">
      <label>
        {t.stateFilter}:
        <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label>
        {t.districtFilter}:
        <select disabled>
          <option>All</option>
        </select>
      </label>

      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', margin: '0 10px' }}></div>

      <label>{t.riskHorizon}:</label>
      <div className="horizon-group">
        <label>
          <input type="radio" name="horizon" value="nowcast" checked={riskHorizon === 'nowcast'} onChange={() => setRiskHorizon('nowcast')} />
          {t.nowcast}
        </label>
        <label>
          <input type="radio" name="horizon" value="24h" checked={riskHorizon === '24h'} onChange={() => setRiskHorizon('24h')} />
          {t.forecast24h}
        </label>
        <label>
          <input type="radio" name="horizon" value="72h" checked={riskHorizon === '72h'} onChange={() => setRiskHorizon('72h')} />
          {t.forecast72h}
        </label>
      </div>
    </div>
  );
}
