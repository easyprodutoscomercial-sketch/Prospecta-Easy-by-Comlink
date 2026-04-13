// Wrapper mínimo em cima de IndexedDB para a fila offline.
// Sem dependências externas.

const DB_NAME = 'controlei-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'queue';

export interface QueuedItem {
  id?: number;
  type: string;            // ex: 'booth-checkin'
  endpoint: string;        // ex: '/api/events/123/checkin'
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;               // payload JSON (uploads grandes viram base64)
  createdAt: number;
  tries: number;
  lastError?: string;
  meta?: Record<string, any>;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result: T;
    Promise.resolve(fn(store))
      .then((r) => { result = r; })
      .catch(reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function queueAdd(item: Omit<QueuedItem, 'id' | 'createdAt' | 'tries'>): Promise<number> {
  const full: QueuedItem = { ...item, createdAt: Date.now(), tries: 0 };
  return tx(STORE_QUEUE, 'readwrite', (store) => {
    return new Promise<number>((resolve, reject) => {
      const req = store.add(full);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function queueList(): Promise<QueuedItem[]> {
  return tx(STORE_QUEUE, 'readonly', (store) => {
    return new Promise<QueuedItem[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedItem[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function queueRemove(id: number): Promise<void> {
  return tx(STORE_QUEUE, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function queueUpdate(id: number, patch: Partial<QueuedItem>): Promise<void> {
  return tx(STORE_QUEUE, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const current = getReq.result as QueuedItem | undefined;
        if (!current) return resolve();
        const updated = { ...current, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function queueCount(): Promise<number> {
  return tx(STORE_QUEUE, 'readonly', (store) => {
    return new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function queueClear(): Promise<void> {
  return tx(STORE_QUEUE, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}
