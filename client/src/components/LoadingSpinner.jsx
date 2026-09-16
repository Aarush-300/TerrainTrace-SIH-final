import React from 'react';

const LoadingSpinner = ({ loading, message }) => {
  if (!loading) return null;

  return (
    <div className="loading-overlay">
      <div className="spinner"></div>
      <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>
        {message || 'Analyzing terrain data...'}
      </div>
    </div>
  );
};

export default LoadingSpinner;
