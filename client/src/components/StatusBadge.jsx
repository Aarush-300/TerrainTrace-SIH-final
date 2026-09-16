import React from 'react';

/**
 * Reusable status pill.
 *
 * status: 'loading' | 'ok' | 'partial' | 'error' | 'offline' | 'stale'
 * label: optional override text
 */
const STATUS_CONFIG = {
  loading: { cls: 'status-loading', text: '⏳ Loading' },
  ok:      { cls: 'status-ok',      text: '✓ Live'    },
  partial: { cls: 'status-partial', text: '⚠ Partial' },
  error:   { cls: 'status-error',   text: '✕ Error'   },
  offline: { cls: 'status-offline', text: '⊗ Offline' },
  stale:   { cls: 'status-stale',   text: '⏱ Stale'  },
};

const StatusBadge = ({ status = 'loading', label }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  return (
    <span className={`status-badge ${cfg.cls}`}>
      {label ?? cfg.text}
    </span>
  );
};

export default StatusBadge;

