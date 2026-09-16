self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  // Open IndexedDB directly (no idb wrapper in SW context)
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('terrain-trace', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction('pending-reports', 'readonly');
  const store = tx.objectStore('pending-reports');
  const reports = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const report of reports) {
    try {
      const resp = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (resp.ok) {
        const deleteTx = db.transaction('pending-reports', 'readwrite');
        deleteTx.objectStore('pending-reports').delete(report.id);
      }
    } catch (_) { /* will retry on next sync */ }
  }
}
