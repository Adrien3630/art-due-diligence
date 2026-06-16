/*
  Coffre chiffré — état au repos protégé par une phrase secrète.

  Tout l'historique et les réglages (clés API comprises) sont chiffrés en un seul
  blob AES-GCM dans localStorage. La clé dérivée ne vit qu'en mémoire, le temps
  de la session ; verrouiller la purge. La phrase secrète n'est jamais stockée.

  Stratégie pour ne pas casser les appelants synchrones existants : après
  déverrouillage, le contenu déchiffré est tenu en CACHE mémoire ; `storage.ts`
  lit ce cache de façon synchrone, et les écritures re-chiffrent + persistent.

  ⚠️ Si la phrase secrète est perdue, les données sont IRRÉCUPÉRABLES (par
  conception). D'où l'export chiffré, à conserver hors-machine (rétention 5 ans).

  Migration : des données en clair d'une version antérieure (provenance.*.v2/v3)
  sont importées dans le coffre à sa création, puis supprimées.
*/

import {
  deriveKey,
  decryptJson,
  encryptJson,
  randomBytes,
  toBase64,
  fromBase64,
  PBKDF2_ITERATIONS,
  type Sealed,
} from "./crypto";
import type { Dossier, Settings } from "./types";

const VAULT_KEY = "provenance.vault.v1";
const LEGACY_SETTINGS = "provenance.settings.v2";
const LEGACY_HISTORY = "provenance.history.v3";

export const DEFAULT_SETTINGS: Settings = {
  fournisseur: "sanctions_io",
  apiKey: "",
  nomGalerie: "",
  signataire: "",
  seuilVigilanceEur: 10000,
  marcheFournisseur: "aucun",
  marcheApiKey: "",
  marcheEndpoint: "",
};

interface VaultBlob {
  v: 1;
  salt: string; // base64
  iterations: number;
  sealed: Sealed;
}

export interface VaultContent {
  settings: Settings;
  history: Dossier[];
}

/** Erreur de stockage plein (quota dépassé). */
export class StorageFullError extends Error {
  constructor() {
    super("Stockage local plein — exportez puis allégez l'historique.");
    this.name = "StorageFullError";
  }
}

// ── État de session (mémoire seulement) ─────────────────────────────────
let key: CryptoKey | null = null;
let content: VaultContent | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readBlob(): VaultBlob | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultBlob;
  } catch {
    return null;
  }
}

export function hasVault(): boolean {
  return readBlob() !== null;
}

export function hasLegacyData(): boolean {
  if (!canUseStorage()) return false;
  return (
    window.localStorage.getItem(LEGACY_SETTINGS) !== null ||
    window.localStorage.getItem(LEGACY_HISTORY) !== null
  );
}

export function isUnlocked(): boolean {
  return content !== null && key !== null;
}

export function getContent(): VaultContent | null {
  return content;
}

/** Lit d'éventuelles données en clair héritées (pour migration). */
function readLegacy(): VaultContent {
  let settings = DEFAULT_SETTINGS;
  let history: Dossier[] = [];
  if (canUseStorage()) {
    try {
      const s = window.localStorage.getItem(LEGACY_SETTINGS);
      if (s) settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) };
    } catch {
      /* ignore */
    }
    try {
      const h = window.localStorage.getItem(LEGACY_HISTORY);
      if (h) history = JSON.parse(h) as Dossier[];
    } catch {
      /* ignore */
    }
  }
  return { settings, history };
}

function clearLegacy(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(LEGACY_SETTINGS);
  window.localStorage.removeItem(LEGACY_HISTORY);
}

/** Persiste le cache courant, chiffré. Lève StorageFullError si quota dépassé. */
export async function persist(): Promise<void> {
  if (!key || !content || !canUseStorage()) return;
  const blob = readBlob();
  const salt = blob ? fromBase64(blob.salt) : randomBytes(16);
  const iterations = blob?.iterations ?? PBKDF2_ITERATIONS;
  const sealed = await encryptJson(key, content);
  const next: VaultBlob = { v: 1, salt: toBase64(salt), iterations, sealed };
  try {
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(next));
  } catch (err) {
    if (err instanceof DOMException && /quota/i.test(err.name + err.message)) {
      throw new StorageFullError();
    }
    throw err;
  }
}

/**
 * Crée le coffre avec une phrase secrète. Migre les données en clair existantes
 * puis les supprime. Déverrouille la session.
 */
export async function createVault(passphrase: string): Promise<void> {
  const salt = randomBytes(16);
  key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  content = readLegacy();
  // Persiste avec ce sel précis (persist() relit le blob ; on l'écrit d'abord).
  const sealed = await encryptJson(key, content);
  const blob: VaultBlob = {
    v: 1,
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    sealed,
  };
  if (canUseStorage()) {
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
    clearLegacy();
  }
}

/** Déverrouille avec la phrase secrète. Renvoie false si elle est incorrecte. */
export async function unlock(passphrase: string): Promise<boolean> {
  const blob = readBlob();
  if (!blob) return false;
  try {
    const k = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
    const c = (await decryptJson(k, blob.sealed)) as VaultContent;
    key = k;
    content = { settings: { ...DEFAULT_SETTINGS, ...c.settings }, history: c.history ?? [] };
    return true;
  } catch {
    return false;
  }
}

/** Purge la clé et le contenu déchiffré de la mémoire. */
export function lock(): void {
  key = null;
  content = null;
}

/** Renvoie le blob chiffré courant (pour export hors-machine). */
export function exportBlob(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(VAULT_KEY);
}

/**
 * Importe un blob chiffré exporté, validé par la phrase secrète. Remplace le
 * coffre courant. Renvoie false si le format ou la phrase sont invalides.
 */
export async function importBlob(blobJson: string, passphrase: string): Promise<boolean> {
  let blob: VaultBlob;
  try {
    blob = JSON.parse(blobJson) as VaultBlob;
    if (blob.v !== 1 || !blob.salt || !blob.sealed) return false;
  } catch {
    return false;
  }
  try {
    const k = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
    const c = (await decryptJson(k, blob.sealed)) as VaultContent;
    if (canUseStorage()) window.localStorage.setItem(VAULT_KEY, blobJson);
    key = k;
    content = { settings: { ...DEFAULT_SETTINGS, ...c.settings }, history: c.history ?? [] };
    return true;
  } catch {
    return false;
  }
}
