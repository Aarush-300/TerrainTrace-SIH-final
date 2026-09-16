import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import { submitReportWithMedia, getReports } from '../api/reportsApi.js';
import { savePendingReport, registerSync } from '../utils/offlineSync.js';
import en from '../i18n/en.json';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

const t = en;

// Default custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function ReportPage() {
  const [formData, setFormData] = useState({
    type: 'OTHER',
    severity: 'LOW',
    description: '',
    latitude: '',
    longitude: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [locationMsg, setLocationMsg] = useState('');
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const isOnline = navigator.onLine;

  useEffect(() => {
    getReports({ limit: 20 }).then(setRecentReports).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLocationMsg(t.compressingImage);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp'
      });
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));

      const gpsData = await exifr.gps(file);
      if (gpsData && gpsData.latitude && gpsData.longitude) {
        setFormData(prev => ({
          ...prev,
          latitude: gpsData.latitude.toFixed(6),
          longitude: gpsData.longitude.toFixed(6)
        }));
        setLocationMsg(t.locationFromExif);
      } else {
        setLocationMsg('');
      }
    } catch (err) {
      console.error(err);
      setLocationMsg('');
    }
  };

  const handleGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setLocationMsg(t.locationDetected);
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const submitData = new FormData();
    submitData.append('type', formData.type);
    submitData.append('severity', formData.severity);
    submitData.append('description', formData.description);
    submitData.append('latitude', formData.latitude);
    submitData.append('longitude', formData.longitude);
    if (photo) {
      submitData.append('photo', photo);
    }

    if (isOnline) {
      try {
        await submitReportWithMedia(submitData);
        alert(t.reportSubmitted);
        setFormData({ type: 'OTHER', severity: 'LOW', description: '', latitude: '', longitude: '' });
        setPhoto(null);
        setPhotoPreview(null);
        setLocationMsg('');
        getReports({ limit: 20 }).then(setRecentReports);
      } catch (err) {
        alert(t.errorOccurred);
      }
    } else {
      await savePendingReport({
        type: formData.type,
        severity: formData.severity,
        description: formData.description,
        latitude: formData.latitude,
        longitude: formData.longitude,
        photoUrl: photoPreview // store object url for offline view if needed
      });
      registerSync();
      alert(t.offlineSaved);
    }
    setLoading(false);
  };

  const lat = parseFloat(formData.latitude) || 20;
  const lng = parseFloat(formData.longitude) || 78;

  return (
    <div className="page-container">
      <h1 className="page-title">{t.reportPageTitle}</h1>
      <p className="page-subtitle">{t.reportPageSubtitle}</p>

      <form className="report-page-form" onSubmit={handleSubmit}>
        <label className="form-label">{t.selectIncidentType}</label>
        <select className="form-input" name="type" value={formData.type} onChange={handleChange}>
          <option value="CRACK">CRACK</option>
          <option value="ROCKFALL">ROCKFALL</option>
          <option value="MUDSLIDE">MUDSLIDE</option>
          <option value="ROAD_BLOCKAGE">ROAD_BLOCKAGE</option>
          <option value="SLOPE_MOVEMENT">SLOPE_MOVEMENT</option>
          <option value="OTHER">OTHER</option>
        </select>

        <label className="form-label">{t.selectSeverity}</label>
        <select className="form-input" name="severity" value={formData.severity} onChange={handleChange}>
          <option value="LOW">LOW</option>
          <option value="MODERATE">MODERATE</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <label className="form-label">{t.description}</label>
        <textarea className="form-input" name="description" value={formData.description} onChange={handleChange} rows={3}></textarea>

        <label className="form-label">{t.capturePhoto}</label>
        <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="form-input" style={{ padding: '0.25rem' }} />
        {photoPreview && <img src={photoPreview} alt="Preview" className="photo-preview" />}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t.latitude}</label>
            <input type="number" step="any" className="form-input" name="latitude" value={formData.latitude} onChange={handleChange} required />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t.longitude}</label>
            <input type="number" step="any" className="form-input" name="longitude" value={formData.longitude} onChange={handleChange} required />
          </div>
        </div>
        
        <button type="button" className="gps-btn" onClick={handleGps}>
          📍 {t.useMyLocation}
        </button>
        {locationMsg && <div className="gps-msg">{locationMsg}</div>}

        {(formData.latitude && formData.longitude) && (
          <div className="mini-map-preview">
            <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <Marker position={[lat, lng]} icon={customIcon} />
            </MapContainer>
          </div>
        )}

        <button type="submit" className="refresh-btn" style={{ marginTop: '1.5rem' }} disabled={loading}>
          {loading ? t.submitting : t.submitReport}
        </button>
      </form>

      <div className="recent-reports-list">
        <h3>{t.recentReports}</h3>
        {recentReports.map(r => (
          <div key={r.id} className="report-card">
            <div className="report-card-header">
              <span className="report-card-type">{r.type}</span>
              <span>{new Date(r.reported_at || Date.now()).toLocaleDateString()}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '0.5rem' }}>{r.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
