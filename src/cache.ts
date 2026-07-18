const DB_NAME = "jimos-home-dashboard";
const STORE_NAME = "api-cache";

interface CacheEntry<T> {
  key: string;
  value: T;
  storedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, value, storedAt: Date.now() } satisfies CacheEntry<T>);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const db = await openDb();
  const result = await new Promise<CacheEntry<T> | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as CacheEntry<T> | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result ?? null;
}
