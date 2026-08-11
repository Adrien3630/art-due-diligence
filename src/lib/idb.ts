/*
  Petit magasin clé→valeur asynchrone.

  Backend : IndexedDB quand disponible (limites bien supérieures à localStorage —
  adapté aux pièces d'identité / photos volumineuses). Repli automatique sur
  localStorage quand IndexedDB est absent (SSR, environnement de test Node).

  Ne stocke que des chaînes (le coffre y dépose un blob chiffré).
*/

const DB_NAME = "provenance";
const STORE = "kv";
const VERSION = 1;

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasLs(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/* ── Repli localStorage ── */
function lsGet(k: string): string | null {
  return hasLs() ? window.localStorage.getItem(k) : null;
}
function lsSet(k: string, v: string): void {
  if (hasLs()) window.localStorage.setItem(k, v);
}
function lsDel(k: string): void {
  if (hasLs()) window.localStorage.removeItem(k);
}

/* ── IndexedDB ── */
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet(key: string): Promise<string | null> {
  if (!hasIdb()) return lsGet(key);
  const db = await open();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (!hasIdb()) return lsSet(key, value);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function kvDel(key: string): Promise<void> {
  if (!hasIdb()) return lsDel(key);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** IndexedDB est-il le backend actif ? (sinon repli localStorage) */
export function usingIndexedDb(): boolean {
  return hasIdb();
}
