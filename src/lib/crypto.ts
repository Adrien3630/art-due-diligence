/*
  Primitives de chiffrement — AES-GCM (256 bits) avec clé dérivée d'une phrase
  secrète par PBKDF2 (SHA-256). PUR (aucune dépendance UI ni stockage).

  Modèle de menace : protéger les données au repos sur le poste (pièces
  d'identité, identités, clés API) contre une lecture directe du localStorage /
  du disque. Ce N'EST PAS une protection contre un poste compromis pendant que
  le coffre est déverrouillé. La phrase secrète n'est jamais stockée ; seule la
  clé dérivée vit en mémoire le temps de la session.

  WebCrypto (`crypto.subtle`) : contexte sécurisé (localhost, Tauri) et Node 20+.
*/

import { argon2id } from "hash-wasm";

// Coût PBKDF2 (format de coffre v1, hérité). Élevé volontairement.
export const PBKDF2_ITERATIONS = 210_000;

// Paramètres Argon2id (coffre v2). Memory-hard : bien plus résistant au
// force-brute GPU que PBKDF2. 64 Mio est un bon compromis navigateur.
export const ARGON2_PARAMS = { memKiB: 65_536, iterations: 3, parallelism: 1 } as const;
export type Argon2Params = { memKiB: number; iterations: number; parallelism: number };

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── base64 (sûr pour gros buffers : encodage par fragments) ── */

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/**
 * Copie les octets dans un ArrayBuffer dédié. WebCrypto attend un BufferSource
 * adossé à un ArrayBuffer (et non un éventuel SharedArrayBuffer) — cette copie
 * satisfait le typage strict tout en restant correcte à l'exécution.
 */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

/* ── Dérivation de clé + chiffrement ── */

/** Dérive une clé AES-GCM 256 bits d'une phrase secrète (PBKDF2-SHA256). */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    ab(enc.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Dérive une clé AES-GCM 256 bits d'une phrase secrète par Argon2id (coffre v2). */
export async function deriveKeyArgon2(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2Params = ARGON2_PARAMS,
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passphrase,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memKiB,
    hashLength: 32,
    outputType: "binary",
  });
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface Sealed {
  iv: string; // base64
  ct: string; // base64 (ciphertext + tag)
}

/* ── Enveloppe (key-wrapping) : chiffre/déchiffre des octets bruts ── */

/** Chiffre des octets bruts (ex. une clé de données) sous une clé d'enveloppe. */
export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(data));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/** Déchiffre des octets bruts (lève si la clé d'enveloppe est incorrecte). */
export async function decryptBytes(key: CryptoKey, sealed: Sealed): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ab(fromBase64(sealed.iv)) },
    key,
    ab(fromBase64(sealed.ct)),
  );
  return new Uint8Array(plain);
}

/** Importe des octets bruts (clé de données) en clé AES-GCM de chiffrement du contenu. */
export function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/* ── Clé de récupération (base32 Crockford, sans caractères ambigus) ── */

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // sans I, L, O, U

/** Génère une clé de récupération à haute entropie (160 bits), lisible/transcriptible. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(20); // 160 bits
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  // Groupes de 4 pour la lisibilité : « K3M9-QPTW-… ».
  return out.match(/.{1,4}/g)!.join("-");
}

/** Normalise une clé de récupération saisie (majuscules, sans séparateurs). */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Chiffre une valeur JSON. IV aléatoire par opération (jamais réutilisé). */
export async function encryptJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(data));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/**
 * Déchiffre une valeur JSON. Lève une erreur si la clé (phrase secrète) est
 * incorrecte ou si les données sont altérées — AES-GCM est authentifié.
 */
export async function decryptJson(key: CryptoKey, sealed: Sealed): Promise<unknown> {
  const iv = fromBase64(sealed.iv);
  const ct = fromBase64(sealed.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(ct));
  return JSON.parse(dec.decode(plain));
}
