// Wrapper mínimo em cima de IndexedDB para a fila offline.
// Sem dependências externas.

const DB_NAME = 'controlei-offline';
const DB_VERSION = 2;
const STORE_QUEUE = 'queue';
const STORE_DRAFTS = 'drafts';

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

export interface DraftItem {
  key: string;             // ex: 'checkin-{eventId}-{boothId}'
  data: any;               // JSON-serializable (fotos em base64)
  updatedAt: number;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const oldVersion = (ev as IDBVersionChangeEvent).oldVersion || 0;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // Bump v1 -> v2: adiciona store de drafts
      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_DRAFTS)) {
        const draftStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
        draftStore.createIndex('updatedAt', 'updatedAt', { unique: false });
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

// ===== DRAFTS (rascunhos de formulários, sobrevivem ao recarregar a página) =====

export async function draftSave(key: string, data: any): Promise<void> {
  if (!isBrowser()) return;
  const item: DraftItem = { key, data, updatedAt: Date.now() };
  return tx(STORE_DRAFTS, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function draftLoad<T = any>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  if (!isBrowser()) return null;
  return tx(STORE_DRAFTS, 'readonly', (store) => {
    return new Promise<{ data: T; updatedAt: number } | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as DraftItem | undefined;
        if (!result) return resolve(null);
        resolve({ data: result.data as T, updatedAt: result.updatedAt });
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function draftClear(key: string): Promise<void> {
  if (!isBrowser()) return;
  return tx(STORE_DRAFTS, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// Lista todos os drafts cuja chave comeca com o prefixo dado.
// Usado quando o usuario pode ter VARIOS rascunhos do mesmo tipo em paralelo
// (ex: multiplos contatos avulsos em feira), pra mostrar a lista de pendentes.
// Ordenado do mais recente pro mais antigo.
export async function draftListByPrefix(prefix: string): Promise<DraftItem[]> {
  if (!isBrowser()) return [];
  return tx(STORE_DRAFTS, 'readonly', (store) => {
    return new Promise<DraftItem[]>((resolve, reject) => {
      const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
      const items: DraftItem[] = [];
      const req = store.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          items.push(cursor.value as DraftItem);
          cursor.continue();
        } else {
          items.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

// Remove drafts mais antigos que maxAgeMs (ex: 7 dias = 604800000 ms).
// Útil pra não acumular rascunhos esquecidos indefinidamente.
export async function draftPruneOld(maxAgeMs: number): Promise<number> {
  if (!isBrowser()) return 0;
  const cutoff = Date.now() - maxAgeMs;
  return tx(STORE_DRAFTS, 'readwrite', (store) => {
    return new Promise<number>((resolve, reject) => {
      const idx = store.index('updatedAt');
      const range = IDBKeyRange.upperBound(cutoff, true);
      let removed = 0;
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          resolve(removed);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}
