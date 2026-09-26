/**
 * Tiny IndexedDB helper shared by the app and the service worker (no dependencies).
 * Database "vb" v1: store "events" (exercise events waiting to sync, key client_event_id) and
 * store "kv" (small values the service worker needs, e.g. the next session's name for the
 * reminder text). Every call resolves to a fallback instead of throwing.
 */
export const IDB_NAME = "vb";
const VERSION = 1;

export function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("events")) db.createObjectStore("events", { keyPath: "client_event_id" });
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(store: "events" | "kv", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(req ? (req.result as T) : null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const idbPut = <T>(store: "events", value: T) => run(store, "readwrite", (s) => s.put(value)).then((r) => r !== null);
export const idbDelete = (store: "events", key: string) => run(store, "readwrite", (s) => s.delete(key));
export const idbAll = <T>(store: "events") => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>).then((r) => r ?? []);
export const kvGet = <T>(key: string) => run<T>("kv", "readonly", (s) => s.get(key) as IDBRequest<T>);
export const kvSet = (key: string, value: unknown) => run("kv", "readwrite", (s) => s.put(value, key));
