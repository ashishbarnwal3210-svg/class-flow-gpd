// IndexedDB offline storage for in-app downloads (like Hotstar / YouTube offline)

export interface OfflineDownload {
  id: string; // resource id
  title: string;
  description: string | null;
  category: string;
  subjectName?: string;
  authorName?: string;
  createdAt: string;
  downloadedAt: number;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  blob: Blob;
}

const DB_NAME = 'classflow_offline_storage';
const STORE_NAME = 'downloads';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineDownload(item: OfflineDownload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineDownloads(): Promise<OfflineDownload[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result || []) as OfflineDownload[];
        // Sort newest download first
        results.sort((a, b) => b.downloadedAt - a.downloadedAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function getOfflineDownload(id: string): Promise<OfflineDownload | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function deleteOfflineDownload(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function isResourceDownloaded(id: string): Promise<boolean> {
  const item = await getOfflineDownload(id);
  return Boolean(item);
}

export async function downloadResourceLocally(
  resource: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    subject?: { name?: string } | null;
    profiles?: { full_name?: string } | null;
    created_at: string;
  },
  file: {
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  },
  downloadUrl: string
): Promise<OfflineDownload> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`);
  }
  const blob = await response.blob();

  const item: OfflineDownload = {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    category: resource.category,
    subjectName: resource.subject?.name,
    authorName: resource.profiles?.full_name,
    createdAt: resource.created_at,
    downloadedAt: Date.now(),
    fileId: file.id,
    fileName: file.original_name,
    mimeType: file.mime_type || blob.type || 'application/octet-stream',
    fileSize: blob.size || file.size_bytes,
    blob
  };

  await saveOfflineDownload(item);
  return item;
}
