import React, { useState } from 'react';
import { submitReport } from '../api/reportsApi.js';
import { REPORT_TYPES } from '../types/risk.js';
import StatusBadge from './StatusBadge.jsx';
import t from '../i18n/en.json';

/**
 * FieldReportForm — mobile-friendly collapsible report form.
 *
 * Props:
 *   defaultLat: pre-filled latitude (from last map click)
 *   defaultLng: pre-filled longitude (from last map click)
 *   onSubmitted: callback(reportId) called after successful submit
 */
const FieldReportForm = ({ defaultLat = '', defaultLng = '', onSubmitted }) => {
  const [open, setOpen]           = useState(false);
  const [lat, setLat]             = useState(String(defaultLat));
  const [lng, setLng]             = useState(String(defaultLng));
  const [type, setType]           = useState(REPORT_TYPES[0]);
  const [desc, setDesc]           = useState('');
  const [photoRef, setPhotoRef]   = useState('');
  const [status, setStatus]       = useState('idle'); // idle | loading | ok | error
  const [errorMsg, setErrorMsg]   = useState('');

  // Sync lat/lng when map click updates parent defaults
  React.useEffect(() => { setLat(String(defaultLat ?? '')); }, [defaultLat]);
  React.useEffect(() => { setLng(String(defaultLng ?? '')); }, [defaultLng]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await submitReport({
        latitude:        parseFloat(lat),
        longitude:       parseFloat(lng),
        type,
        description:     desc || undefined,
        image_reference: photoRef || undefined,
      });
      setStatus('ok');
      setDesc('');
      setPhotoRef('');
      onSubmitted?.(result.id);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.response?.data?.error || t.errorOccurred);
    }
  };

  if (!open) {
    return (
      <button className="refresh-btn" onClick={() => setOpen(true)}>
        + {t.addFieldReport}
      </button>
    );
  }

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      <div className="report-form-header">
        <strong>{t.addFieldReport}</strong>
        <button type="button" className="link-btn" onClick={() => { setOpen(false); setStatus('idle'); }}>
          {t.cancel}
        </button>
      </div>

      {status === 'ok' && (
        <div className="report-success">{t.reportSubmitted}</div>
      )}
      {status === 'error' && (
        <div className="prediction-error">
          <StatusBadge status="error" /> {errorMsg}
        </div>
      )}

      <label className="form-label">
        {t.reportType}
        <select value={type} onChange={e => setType(e.target.value)} className="form-input">
          {REPORT_TYPES.map(rt => (
            <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label className="form-label half">
          {t.latitude}
          <input
            type="number" step="any" required
            value={lat} onChange={e => setLat(e.target.value)}
            className="form-input"
          />
        </label>
        <label className="form-label half">
          {t.longitude}
          <input
            type="number" step="any" required
            value={lng} onChange={e => setLng(e.target.value)}
            className="form-input"
          />
        </label>
      </div>

      <label className="form-label">
        {t.description}
        <textarea
          rows={3}
          value={desc} onChange={e => setDesc(e.target.value)}
          className="form-input"
          placeholder="Optional details…"
        />
      </label>

      <label className="form-label">
        {t.photoReference}
        <input
          type="url"
          value={photoRef} onChange={e => setPhotoRef(e.target.value)}
          className="form-input"
          placeholder="https://…"
        />
      </label>

      <button
        type="submit"
        className="refresh-btn"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? t.submitting : t.submitReport}
      </button>
    </form>
  );
};

export default FieldReportForm;

