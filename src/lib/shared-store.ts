// IndexedDB helper to hold files shared via Android/iOS Web Share Target API
const DB_NAME = 'classflow-share-db';
const STORE_NAME = 'shared-files';

export function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSharedData(data: { files?: File[]; title?: string; text?: string; url?: string }): Promise<void> {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ ...data, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAndClearSharedData(): Promise<{ files?: File[]; title?: string; text?: string; url?: string } | null> {
  try {
    const db = await openShareDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result;
        if (!items || items.length === 0) {
          resolve(null);
          return;
        }
        store.clear();
        // Return latest shared bundle
        resolve(items[items.length - 1]);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
