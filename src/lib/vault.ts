/*
  Coffre chiffré — état au repos protégé par une phrase secrète.

  Tout l'historique et les réglages (clés API comprises) sont chiffrés en un seul
  blob AES-GCM, persisté via IndexedDB (repli localStorage hors navigateur). La
  clé dérivée ne vit qu'en mémoire, le temps de la session ; verrouiller la purge.
  La phrase secrète n'est jamais stockée.

  Stratégie pour ne pas casser les appelants synchrones : après déverrouillage, le
  contenu déchiffré est tenu en CACHE mémoire ; `storage.ts` le lit de façon
  synchrone, et les écritures re-chiffrent + persistent (asynchrone).

  ⚠️ Si la phrase secrète est perdue, les données sont IRRÉCUPÉRABLES (par
  conception). D'où l'export chiffré, à conserver hors-machine (rétention 5 ans).

  Migrations gérées :
   • données en clair d'une version antérieure (provenance.*.v2/v3) → importées à
     la création du coffre, puis supprimées ;
   • coffre antérieur stocké dans localStorage → migré vers IndexedDB à la lecture.
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
import { kvGet, kvSet, usingIndexedDb } from "./idb";
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
  revueIntervalleMois: 12,
  horodatageActif: false,
  horodatageTsaUrl: "",
  autoLockMinutes: 10,
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
  // Brouillons de saisie en cours (auto-save chiffré, #2). Optionnel : absent des
  // coffres antérieurs.
  drafts?: Record<string, unknown>;
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
let saltB64: string | null = null;
let iterations = PBKDF2_ITERATIONS;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Lit le blob brut, en migrant un éventuel coffre localStorage vers IndexedDB. */
async function readBlobRaw(): Promise<string | null> {
  const v = await kvGet(VAULT_KEY);
  if (v) return v;
  if (usingIndexedDb() && canUseLocalStorage()) {
    const legacy = window.localStorage.getItem(VAULT_KEY);
    if (legacy) {
      await kvSet(VAULT_KEY, legacy);
      window.localStorage.removeItem(VAULT_KEY);
      return legacy;
    }
  }
  return null;
}

async function readBlob(): Promise<VaultBlob | null> {
  const raw = await readBlobRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultBlob;
  } catch {
    return null;
  }
}

export async function hasVault(): Promise<boolean> {
  return (await readBlobRaw()) !== null;
}

export function hasLegacyData(): boolean {
  if (!canUseLocalStorage()) return false;
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
  if (canUseLocalStorage()) {
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
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(LEGACY_SETTINGS);
  window.localStorage.removeItem(LEGACY_HISTORY);
}

/** Persiste le cache courant, chiffré. Lève StorageFullError si quota dépassé. */
export async function persist(): Promise<void> {
  if (!key || !content || !saltB64) return;
  const sealed = await encryptJson(key, content);
  const next: VaultBlob = { v: 1, salt: saltB64, iterations, sealed };
  try {
    await kvSet(VAULT_KEY, JSON.stringify(next));
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
  saltB64 = toBase64(salt);
  iterations = PBKDF2_ITERATIONS;
  key = await deriveKey(passphrase, salt, iterations);
  content = readLegacy();
  await persist();
  clearLegacy();
}

/** Déverrouille avec la phrase secrète. Renvoie false si elle est incorrecte. */
export async function unlock(passphrase: string): Promise<boolean> {
  const blob = await readBlob();
  if (!blob) return false;
  try {
    const k = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
    const c = (await decryptJson(k, blob.sealed)) as VaultContent;
    key = k;
    saltB64 = blob.salt;
    iterations = blob.iterations;
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
  saltB64 = null;
}

/** Renvoie le blob chiffré courant (pour export hors-machine). */
export async function exportBlob(): Promise<string | null> {
  return readBlobRaw();
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
    await kvSet(VAULT_KEY, blobJson);
    key = k;
    saltB64 = blob.salt;
    iterations = blob.iterations;
    content = { settings: { ...DEFAULT_SETTINGS, ...c.settings }, history: c.history ?? [] };
    return true;
  } catch {
    return false;
  }
}
