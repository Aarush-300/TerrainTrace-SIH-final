import { openDB } from 'idb';

const DB_NAME = 'terrain-trace';
const STORE_NAME = 'pending-reports';
const DB_VERSION = 1;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function savePendingReport(report) {
  const db = await getDb();
  return db.add(STORE_NAME, { ...report, savedAt: new Date().toISOString() });
}

export async function getPendingReports() {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function clearPendingReport(id) {
  const db = await getDb();
  return db.delete(STORE_NAME, id);
}

export function registerSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-reports')).catch(() => {});
  }
}
