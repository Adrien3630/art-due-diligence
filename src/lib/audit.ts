/*
  Piste d'audit CHAÎNÉE — tamper-evident.

  Chaque événement intègre le hash SHA-256 du précédent. Altérer (ou supprimer)
  un événement passé invalide toute la chaîne en aval → `verifyTrail` le détecte.

  HONNÊTETÉ : c'est une intégrité *détectable*, pas un horodatage légal opposable.
  Un vrai horodatage qualifié exigerait un tiers de confiance (RFC 3161) — option
  future. On ne prétend donc pas « immuable », mais « inviolable sans laisser de
  trace » sur ce poste.

  Pur (aucune dépendance UI). Utilise WebCrypto (`crypto.subtle`), disponible en
  contexte sécurisé (localhost, Tauri) et sous Node 20+.
*/

import type { AuditEvent, AuditEventType } from "./types";

const GENESIS = "GENESIS";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Charge utile hachée pour un événement (ordre + contenu + chaînage). */
function payload(e: Omit<AuditEvent, "hash">): string {
  return `${e.seq}|${e.horodatage}|${e.type}|${e.detail}|${e.hashPrec}`;
}

/** Ajoute un événement à la chaîne (append-only) et renvoie une NOUVELLE liste. */
export async function appendEvent(
  trail: AuditEvent[],
  type: AuditEventType,
  detail: string,
): Promise<AuditEvent[]> {
  const prev = trail[trail.length - 1];
  const base: Omit<AuditEvent, "hash"> = {
    seq: trail.length,
    horodatage: new Date().toISOString(),
    type,
    detail,
    hashPrec: prev ? prev.hash : GENESIS,
  };
  const hash = await sha256Hex(payload(base));
  return [...trail, { ...base, hash }];
}

/** Construit une chaîne complète à partir d'une séquence d'événements. */
export async function buildTrail(
  events: { type: AuditEventType; detail: string }[],
): Promise<AuditEvent[]> {
  let trail: AuditEvent[] = [];
  for (const e of events) {
    trail = await appendEvent(trail, e.type, e.detail);
  }
  return trail;
}

/** Vérifie l'intégrité de la chaîne (hash + chaînage). */
export async function verifyTrail(trail: AuditEvent[]): Promise<boolean> {
  let prevHash = GENESIS;
  for (let i = 0; i < trail.length; i++) {
    const e = trail[i];
    if (e.seq !== i || e.hashPrec !== prevHash) return false;
    const expected = await sha256Hex(
      payload({ seq: e.seq, horodatage: e.horodatage, type: e.type, detail: e.detail, hashPrec: e.hashPrec }),
    );
    if (expected !== e.hash) return false;
    prevHash = e.hash;
  }
  return true;
}

/** Libellés lisibles des types d'événements. */
export const AUDIT_LABEL: Record<AuditEventType, string> = {
  dossier_cree: "Dossier créé",
  screening_lance: "Screening lancé",
  screening_resultat: "Résultat de screening",
  piece_ajoutee: "Pièce ajoutée",
  match_ecarte: "Correspondance écartée",
  gel_avoirs_signale: "Gel des avoirs — notification préparée",
  decision_saisie: "Décision saisie",
  dossier_archive: "Dossier archivé",
};
