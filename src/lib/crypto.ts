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

// Coût PBKDF2. Élevé volontairement (anti force-brute hors-ligne).
export const PBKDF2_ITERATIONS = 210_000;

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

export interface Sealed {
  iv: string; // base64
  ct: string; // base64 (ciphertext + tag)
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
