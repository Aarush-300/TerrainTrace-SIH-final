import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import en from '../i18n/en.json';

const t = en;

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

const NavShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isOnline = useOnlineStatus();

  return (
    <div className="nav-shell">
      {/* Mobile Overlay */}
      {sidebarOpen && <div className="nav-overlay" onClick={() => setSidebarOpen(false)}></div>}
      
      {/* Sidebar */}
      <div className={`nav-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="nav-brand">
          {t.appTitle}
        </div>
        
        <NavLink to="/gis-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <span className="nav-icon">🗺️</span>
          {t.navGisDashboard}
        </NavLink>
        <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <span className="nav-icon">📋</span>
          {t.navReport}
        </NavLink>
        <NavLink to="/safety" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <span className="nav-icon">🛡️</span>
          {t.navSafety}
        </NavLink>
        <NavLink to="/admin/alerts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <span className="nav-icon">🔔</span>
          {t.navAlerts}
        </NavLink>
        <NavLink to="/routes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <span className="nav-icon">🚗</span>
          {t.navRoutes}
        </NavLink>
      </div>

      {/* Main Content Area */}
      <div className="nav-main">
        <div className="nav-header">
          <button className="nav-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div className="nav-header-title">
            {t.appSubtitle}
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '12px', background: isOnline ? '#065f46' : '#991b1b', color: '#fff' }}>
              {isOnline ? t.online : t.offline}
            </span>
          </div>
        </div>
        <div className="nav-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default NavShell;
