import React, { useState, useEffect } from 'react';
import { getReports, updateReportStatus } from '../api/reportsApi.js';
import { createAlert } from '../api/alertsApi.js';
import en from '../i18n/en.json';

const t = en;

export default function AlertDispatchPage() {
  const [pendingReports, setPendingReports] = useState([]);
  const [alertForm, setAlertForm] = useState({
    latitude: '',
    longitude: '',
    radius: 15,
    severity: 'Severe',
    headline: '',
    description: '',
    channels: {
      sms: true,
      push: true,
      dashboard: true
    }
  });
  const [previewLang, setPreviewLang] = useState('en');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    const data = await getReports({ status: 'PENDING' });
    setPendingReports(data);
  };

  const handleVerify = async (id) => {
    await updateReportStatus(id, 'VERIFIED');
    fetchPending();
  };

  const handleReject = async (id) => {
    await updateReportStatus(id, 'REJECTED');
    fetchPending();
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setAlertForm(prev => ({ ...prev, channels: { ...prev.channels, [name]: checked } }));
    } else {
      setAlertForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const getTranslatedPreview = () => {
    // Simple placeholder for translated preview
    const base = `LANDSLIDE WARNING: ${alertForm.severity} risk detected near ${alertForm.latitude},${alertForm.longitude}. ${alertForm.headline} - ${alertForm.description}`;
    if (previewLang === 'hi') return `भूस्खलन चेतावनी: ${alertForm.severity} जोखिम... ${alertForm.headline}`;
    if (previewLang === 'as') return `ভূমিস্খলনৰ সতৰ্কবাণী: ${alertForm.severity}...`;
    if (previewLang === 'bn') return `ভূমিধসের সতর্কতা: ${alertForm.severity}...`;
    return base;
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    try {
      await createAlert({ ...alertForm });
      alert(t.alertSent);
      setAlertForm(prev => ({ ...prev, headline: '', description: '' }));
    } catch (err) {
      alert(t.errorOccurred);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t.alertConsoleTitle}</h1>

      <div className="alert-console-layout">
        <div className="alert-panel">
          <h3>{t.pendingReportsTitle}</h3>
          <table className="pending-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingReports.length === 0 && (
                <tr><td colSpan="3" style={{ textAlign: 'center' }}>No pending reports</td></tr>
              )}
              {pendingReports.map(r => (
                <tr key={r.id}>
                  <td>{r.type} <br/><small>{r.severity}</small></td>
                  <td>{parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</td>
                  <td>
                    <button className="verify-btn" onClick={() => handleVerify(r.id)}>{t.verifyReport}</button>
                    <button className="reject-btn" onClick={() => handleReject(r.id)}>{t.rejectReport}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="alert-panel">
          <h3>{t.broadcastAlert}</h3>
          <form className="broadcast-form" onSubmit={handleSendAlert}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t.latitude}</label>
                <input type="number" step="any" name="latitude" className="form-input" value={alertForm.latitude} onChange={handleFormChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t.longitude}</label>
                <input type="number" step="any" name="longitude" className="form-input" value={alertForm.longitude} onChange={handleFormChange} required />
              </div>
            </div>

            <label className="form-label">{t.affectedRadius}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="range" name="radius" min="5" max="50" value={alertForm.radius} onChange={handleFormChange} style={{ flex: 1 }} />
              <span className="range-value">{alertForm.radius} km</span>
            </div>

            <label className="form-label">{t.alertSeverity}</label>
            <select name="severity" className="form-input" value={alertForm.severity} onChange={handleFormChange}>
              <option value="Extreme">{t.extreme}</option>
              <option value="Severe">{t.severe}</option>
              <option value="Moderate">{t.moderate}</option>
              <option value="Minor">{t.minor}</option>
            </select>

            <label className="form-label">{t.alertMessage}</label>
            <input type="text" name="headline" className="form-input" placeholder="Headline..." value={alertForm.headline} onChange={handleFormChange} style={{ marginBottom: '0.5rem' }} required />
            <textarea name="description" className="form-input" placeholder="Description..." value={alertForm.description} onChange={handleFormChange} rows={3} required></textarea>

            <label className="form-label">{t.deliveryChannels}</label>
            <div className="channels-row">
              <label><input type="checkbox" name="sms" checked={alertForm.channels.sms} onChange={handleFormChange} /> SMS</label>
              <label><input type="checkbox" name="push" checked={alertForm.channels.push} onChange={handleFormChange} /> Push Notification</label>
              <label><input type="checkbox" name="dashboard" checked={alertForm.channels.dashboard} onChange={handleFormChange} /> Dashboard Warning</label>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div className="lang-tabs">
                <div className={`lang-tab ${previewLang === 'en' ? 'active' : ''}`} onClick={() => setPreviewLang('en')}>{t.english}</div>
                <div className={`lang-tab ${previewLang === 'hi' ? 'active' : ''}`} onClick={() => setPreviewLang('hi')}>{t.hindi}</div>
                <div className={`lang-tab ${previewLang === 'as' ? 'active' : ''}`} onClick={() => setPreviewLang('as')}>{t.assamese}</div>
                <div className={`lang-tab ${previewLang === 'bn' ? 'active' : ''}`} onClick={() => setPreviewLang('bn')}>{t.bengali}</div>
              </div>
              <div className="lang-preview">
                {getTranslatedPreview()}
              </div>
            </div>

            <button type="submit" className="send-alert-btn">{t.sendAlert}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
