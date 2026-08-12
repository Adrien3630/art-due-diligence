/*
  Horodatage qualifié RFC 3161 — OPTIONNEL, désactivé par défaut.

  À la clôture d'un dossier, on peut renforcer la force probante de la piste
  d'audit en faisant contresigner son empreinte par une autorité d'horodatage
  qualifiée (TSA, conforme eIDAS / RFC 3161).

  ⚠️ ARBITRAGE DE CONFIDENTIALITÉ (choix explicite de l'utilisateur) :
  cette fonction est la SEULE de l'outil à émettre un appel réseau sortant. Elle
  est donc DÉSACTIVÉE PAR DÉFAUT. Quand elle est activée, SEULE l'empreinte
  SHA-256 (un hash irréversible) quitte la machine — aucune donnée nominative,
  aucun montant, aucun visuel. On ne peut pas reconstruire le dossier à partir du
  hash. Le jeton renvoyé est conservé, chiffré, dans le coffre.

  HONNÊTETÉ : on construit une vraie requête RFC 3161 (`TimeStampReq` en DER) et on
  conserve le jeton opaque renvoyé par la TSA. La VÉRIFICATION cryptographique
  complète du jeton (chaîne de certificats, `genTime`) relève d'un outil standard
  (`openssl ts -verify`) : on ne prétend pas la refaire ici. `buildTimeStampReq`
  est PUR et testé ; l'appel réseau est isolé.
*/

import { fromBase64, randomBytes, toBase64 } from "./crypto";
import type { Settings, TimestampProof } from "./types";

/* ── Encodage DER minimal ───────────────────────────────────────────── */

function encodeLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x = Math.floor(x / 256);
  }
  return [0x80 | bytes.length, ...bytes];
}

/** Tag-Length-Value. */
function tlv(tag: number, content: number[]): number[] {
  return [tag, ...encodeLength(content.length), ...content];
}

function hexToBytes(hex: string): number[] {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Empreinte hexadécimale invalide.");
  }
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

// OID 2.16.840.1.101.3.4.2.1 (SHA-256), contenu DER.
const SHA256_OID = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];

/**
 * Construit une requête RFC 3161 `TimeStampReq` (DER) pour une empreinte
 * SHA-256 (64 caractères hex). `certReq` demande à la TSA de joindre son
 * certificat au jeton. `nonce` (anti-rejeu) optionnel pour rester déterministe
 * en test.
 */
export function buildTimeStampReq(
  sha256Hex: string,
  opts: { nonce?: Uint8Array; certReq?: boolean } = {},
): Uint8Array {
  const hash = hexToBytes(sha256Hex);
  if (hash.length !== 32) throw new Error("SHA-256 attendu (32 octets).");

  const algId = tlv(0x30, [...tlv(0x06, SHA256_OID), 0x05, 0x00]); // AlgorithmIdentifier
  const messageImprint = tlv(0x30, [...algId, ...tlv(0x04, hash)]);
  const version = tlv(0x02, [0x01]); // v1

  const body = [...version, ...messageImprint];
  if (opts.nonce && opts.nonce.length) {
    // INTEGER positif : préfixe 0x00 si le bit de poids fort est à 1.
    const n = [...opts.nonce];
    if (n[0] & 0x80) n.unshift(0x00);
    body.push(...tlv(0x02, n));
  }
  if (opts.certReq !== false) body.push(...tlv(0x01, [0xff])); // certReq = TRUE

  return new Uint8Array(tlv(0x30, body));
}

/* ── Jeton conservé ─────────────────────────────────────────────────── */

// Miroir du type partagé, documenté champ par champ dans types.ts.
export type TimestampToken = TimestampProof;

/** L'horodatage tiers est-il activé et configuré ? */
export function isTimestampingEnabled(settings: Settings): boolean {
  return !!settings.horodatageActif && !!settings.horodatageTsaUrl?.trim();
}

/**
 * Sollicite une TSA RFC 3161 pour horodater une empreinte SHA-256. SEUL le hash
 * est transmis. Renvoie le jeton opaque à conserver. Lève en cas d'échec réseau
 * (jamais maquillé en succès).
 */
export async function requestTimestamp(
  sha256Hex: string,
  tsaUrl: string,
): Promise<TimestampToken> {
  const req = buildTimeStampReq(sha256Hex, { nonce: randomBytes(8) });
  const res = await fetch(tsaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/timestamp-query" },
    body: req as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Horodatage refusé par la TSA (HTTP ${res.status}).`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length) throw new Error("Réponse d'horodatage vide.");
  return {
    hashHex: sha256Hex.trim().toLowerCase(),
    tsaUrl,
    tokenBase64: toBase64(buf),
    obtenuLe: new Date().toISOString(),
  };
}

/** Ré-décode un jeton conservé (pour export / vérification externe). */
export function decodeToken(token: TimestampToken): Uint8Array {
  return fromBase64(token.tokenBase64);
}
