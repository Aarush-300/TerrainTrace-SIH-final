import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavShell from './components/NavShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ReportPage from './pages/ReportPage.jsx';
import SafetyPage from './pages/SafetyPage.jsx';
import AlertDispatchPage from './pages/AlertDispatchPage.jsx';
import EmergencyRoutesPage from './pages/EmergencyRoutesPage.jsx';
import './App.css';

function App() {
  return (
    <Routes>
      <Route element={<NavShell />}>
        <Route index element={<Navigate to="/gis-dashboard" replace />} />
        <Route path="/gis-dashboard" element={<Dashboard />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/safety" element={<SafetyPage />} />
        <Route path="/admin/alerts" element={<AlertDispatchPage />} />
        <Route path="/routes" element={<EmergencyRoutesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
