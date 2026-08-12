/*
  Coffre chiffré — v2 (chiffrement par enveloppe).

  Le contenu ({settings, history, drafts}) est chiffré par une CLÉ DE DONNÉES (DK)
  aléatoire. Cette DK est elle-même « emballée » (wrappée) DEUX fois :
   • sous une clé dérivée de la PHRASE SECRÈTE (Argon2id, memory-hard) ;
   • sous une clé dérivée d'une CLÉ DE RÉCUPÉRATION (haute entropie, à imprimer).

  Conséquences :
   • oublier la phrase ne perd plus tout → la clé de récupération rouvre le coffre
     (on découple récupération et mémorisation) ;
   • changer de phrase ne re-chiffre PAS le contenu : on re-wrappe seulement la DK
     (rapide), la DK et le contenu restent inchangés.

  Compatibilité : les coffres v1 (PBKDF2, clé dérivée chiffrant directement le
  contenu) sont lus puis MIGRÉS en v2 au premier déverrouillage — une clé de
  récupération est alors générée et présentée à l'utilisateur.

  ⚠️ Perte de la phrase ET de la clé de récupération = données irrécupérables.
*/

import {
  deriveKey,
  deriveKeyArgon2,
  decryptJson,
  encryptJson,
  encryptBytes,
  decryptBytes,
  importDataKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  randomBytes,
  toBase64,
  fromBase64,
  ARGON2_PARAMS,
  type Argon2Params,
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

interface VaultBlobV1 {
  v: 1;
  salt: string; // base64
  iterations: number;
  sealed: Sealed; // contenu chiffré directement par la clé PBKDF2
}

interface VaultBlobV2 {
  v: 2;
  kdf: "argon2id";
  params: Argon2Params;
  saltPass: string; // base64 — sel Argon2id (phrase)
  wrapPass: Sealed; // DK emballée sous la clé « phrase »
  saltRecovery: string; // base64 — sel Argon2id (clé de récupération)
  wrapRecovery: Sealed; // DK emballée sous la clé « récupération »
  sealed: Sealed; // contenu chiffré par la DK
}

type VaultBlob = VaultBlobV1 | VaultBlobV2;

export interface VaultContent {
  settings: Settings;
  history: Dossier[];
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
interface V2Meta {
  params: Argon2Params;
  saltPass: string;
  wrapPass: Sealed;
  saltRecovery: string;
  wrapRecovery: Sealed;
}

let dkKey: CryptoKey | null = null; // clé de données (chiffre le contenu)
let dkBytes: Uint8Array | null = null; // DK brute (pour re-wrapper sur changement)
let content: VaultContent | null = null;
let meta: V2Meta | null = null;

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
  return content !== null && dkKey !== null;
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

/** Persiste le cache courant (v2), chiffré. Lève StorageFullError si quota dépassé. */
export async function persist(): Promise<void> {
  if (!dkKey || !content || !meta) return;
  const sealed = await encryptJson(dkKey, content);
  const next: VaultBlobV2 = {
    v: 2,
    kdf: "argon2id",
    params: meta.params,
    saltPass: meta.saltPass,
    wrapPass: meta.wrapPass,
    saltRecovery: meta.saltRecovery,
    wrapRecovery: meta.wrapRecovery,
    sealed,
  };
  try {
    await kvSet(VAULT_KEY, JSON.stringify(next));
  } catch (err) {
    if (err instanceof DOMException && /quota/i.test(err.name + err.message)) {
      throw new StorageFullError();
    }
    throw err;
  }
}

/** Emballe la DK sous une phrase/clé donnée (Argon2id + AES-GCM). */
async function wrapUnder(
  secret: string,
  params: Argon2Params,
): Promise<{ salt: string; wrap: Sealed }> {
  if (!dkBytes) throw new Error("Coffre verrouillé.");
  const salt = randomBytes(16);
  const kek = await deriveKeyArgon2(secret, salt, params);
  const wrap = await encryptBytes(kek, dkBytes);
  return { salt: toBase64(salt), wrap };
}

/** Installe une session v2 à partir d'une DK et d'un contenu. */
function openSession(dk: Uint8Array, key: CryptoKey, c: VaultContent, m: V2Meta): void {
  dkBytes = dk;
  dkKey = key;
  content = { settings: { ...DEFAULT_SETTINGS, ...c.settings }, history: c.history ?? [], drafts: c.drafts };
  meta = m;
}

/**
 * Crée le coffre (v2) avec une phrase secrète. Génère une CLÉ DE RÉCUPÉRATION
 * (à présenter une seule fois). Migre les données en clair héritées.
 */
export async function createVault(passphrase: string): Promise<{ recoveryCode: string }> {
  const dk = randomBytes(32);
  const key = await importDataKey(dk);
  dkBytes = dk;
  const recoveryCode = generateRecoveryCode();

  const p = await wrapUnder(passphrase, ARGON2_PARAMS);
  const r = await wrapUnder(normalizeRecoveryCode(recoveryCode), ARGON2_PARAMS);

  dkKey = key;
  content = readLegacy();
  meta = {
    params: ARGON2_PARAMS,
    saltPass: p.salt,
    wrapPass: p.wrap,
    saltRecovery: r.salt,
    wrapRecovery: r.wrap,
  };
  await persist();
  clearLegacy();
  return { recoveryCode };
}

/**
 * Déverrouille avec la phrase secrète. Renvoie `{ ok }`. Si un coffre v1 est
 * rencontré, il est MIGRÉ en v2 et une clé de récupération est renvoyée
 * (`recoveryCode`) pour affichage — à conserver.
 */
export async function unlock(
  passphrase: string,
): Promise<{ ok: boolean; recoveryCode?: string }> {
  const blob = await readBlob();
  if (!blob) return { ok: false };

  if (blob.v === 2) {
    try {
      const kek = await deriveKeyArgon2(passphrase, fromBase64(blob.saltPass), blob.params);
      const dk = await decryptBytes(kek, blob.wrapPass);
      const key = await importDataKey(dk);
      const c = (await decryptJson(key, blob.sealed)) as VaultContent;
      openSession(dk, key, c, {
        params: blob.params,
        saltPass: blob.saltPass,
        wrapPass: blob.wrapPass,
        saltRecovery: blob.saltRecovery,
        wrapRecovery: blob.wrapRecovery,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // v1 → migration vers v2.
  try {
    const key1 = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
    const c = (await decryptJson(key1, blob.sealed)) as VaultContent;
    const recoveryCode = await migrateToV2(passphrase, c);
    return { ok: true, recoveryCode };
  } catch {
    return { ok: false };
  }
}

/** Reconstruit un coffre v2 (nouvelle DK + clé de récupération) à partir d'un contenu déchiffré. */
async function migrateToV2(passphrase: string, c: VaultContent): Promise<string> {
  const dk = randomBytes(32);
  dkBytes = dk;
  const key = await importDataKey(dk);
  const recoveryCode = generateRecoveryCode();
  const p = await wrapUnder(passphrase, ARGON2_PARAMS);
  const r = await wrapUnder(normalizeRecoveryCode(recoveryCode), ARGON2_PARAMS);
  openSession(dk, key, c, {
    params: ARGON2_PARAMS,
    saltPass: p.salt,
    wrapPass: p.wrap,
    saltRecovery: r.salt,
    wrapRecovery: r.wrap,
  });
  await persist();
  return recoveryCode;
}

/** Déverrouille avec la clé de récupération (coffres v2 uniquement). */
export async function unlockWithRecovery(code: string): Promise<boolean> {
  const blob = await readBlob();
  if (!blob || blob.v !== 2) return false;
  try {
    const kek = await deriveKeyArgon2(
      normalizeRecoveryCode(code),
      fromBase64(blob.saltRecovery),
      blob.params,
    );
    const dk = await decryptBytes(kek, blob.wrapRecovery);
    const key = await importDataKey(dk);
    const c = (await decryptJson(key, blob.sealed)) as VaultContent;
    openSession(dk, key, c, {
      params: blob.params,
      saltPass: blob.saltPass,
      wrapPass: blob.wrapPass,
      saltRecovery: blob.saltRecovery,
      wrapRecovery: blob.wrapRecovery,
    });
    return true;
  } catch {
    return false;
  }
}

/** Change la phrase secrète (re-wrappe la DK ; le contenu n'est pas re-chiffré). */
export async function changePassphrase(newPassphrase: string): Promise<void> {
  if (!meta || !dkBytes) throw new Error("Coffre verrouillé.");
  const p = await wrapUnder(newPassphrase, meta.params);
  meta = { ...meta, saltPass: p.salt, wrapPass: p.wrap };
  await persist();
}

/** Régénère la clé de récupération (invalide l'ancienne). À présenter une fois. */
export async function regenerateRecovery(): Promise<string> {
  if (!meta || !dkBytes) throw new Error("Coffre verrouillé.");
  const recoveryCode = generateRecoveryCode();
  const r = await wrapUnder(normalizeRecoveryCode(recoveryCode), meta.params);
  meta = { ...meta, saltRecovery: r.salt, wrapRecovery: r.wrap };
  await persist();
  return recoveryCode;
}

/** Purge la clé et le contenu déchiffré de la mémoire. */
export function lock(): void {
  dkKey = null;
  dkBytes = null;
  content = null;
  meta = null;
}

/** Renvoie le blob chiffré courant (pour export hors-machine). */
export async function exportBlob(): Promise<string | null> {
  return readBlobRaw();
}

/**
 * Importe un blob chiffré exporté, validé par la phrase secrète. Remplace le
 * coffre courant. Gère les formats v1 (migré) et v2. Renvoie false si le format
 * ou la phrase sont invalides.
 */
export async function importBlob(blobJson: string, passphrase: string): Promise<boolean> {
  let blob: VaultBlob;
  try {
    blob = JSON.parse(blobJson) as VaultBlob;
    if (blob.v !== 1 && blob.v !== 2) return false;
  } catch {
    return false;
  }
  // On écrit le blob importé, puis on le déverrouille via le chemin normal.
  await kvSet(VAULT_KEY, blobJson);
  const res = await unlock(passphrase);
  return res.ok;
}
