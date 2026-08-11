/*
  Référentiel de juridictions à risque (GAFI / FATF).

  But : DÉRIVER le risque-pays automatiquement à partir du pays saisi, au lieu
  de le DEMANDER au galeriste. Une question intrusive de moins.

  ⚠️ HONNÊTETÉ : ces listes sont INDICATIVES et évoluent à chaque plénière du
  GAFI (~3×/an : février / juin / octobre). Le snapshot ci-dessous doit être
  tenu à jour manuellement. Un garde-fou (`isGafiSnapshotStale`) signale la
  péremption au-delà de deux cycles, pour que l'outil n'affirme jamais une
  fraîcheur qu'il n'a pas.

  Source du snapshot : plénière GAFI du 19 juin 2026.
  https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions/increased-monitoring-june-2026.html
*/

/** Libellé affichable de la date du snapshot. */
export const GAFI_SNAPSHOT_DATE = "juin 2026";
/** Date machine de la plénière source (ISO) — sert au calcul de péremption. */
export const GAFI_SNAPSHOT_ISO = "2026-06-19";
/** Au-delà de ce nombre de mois, le snapshot est réputé périmé (~2 plénières). */
export const GAFI_SNAPSHOT_MAX_AGE_MONTHS = 8;

/** « Appel à l'action » (liste noire) — risque le plus élevé. Inchangée depuis 2020. */
const APPEL_ACTION = new Set([
  "coree du nord",
  "coree du nord (rpdc)",
  "rpdc",
  "iran",
  "birmanie",
  "myanmar",
]);

/**
 * « Surveillance renforcée » (liste grise) — vigilance accrue.
 * Snapshot : plénière du 19 juin 2026 (22 juridictions).
 */
const SURVEILLANCE_RENFORCEE = new Set([
  "angola",
  "bolivie",
  "bolivia",
  "bosnie-herzegovine",
  "bosnie",
  "bulgarie",
  "cameroun",
  "cote d'ivoire",
  "republique democratique du congo",
  "rd congo",
  "haiti",
  "irak",
  "iraq",
  "kenya",
  "koweit",
  "kuwait",
  "laos",
  "liban",
  "monaco",
  "nepal",
  "papouasie-nouvelle-guinee",
  "papouasie",
  "soudan du sud",
  "syrie",
  "venezuela",
  "vietnam",
  "iles vierges britanniques",
  "british virgin islands",
  "yemen",
]);

export type JurisdictionRisk = "none" | "monitored" | "high";

/** Normalise un nom de pays pour comparaison (sans accents, minuscules). */
function normalize(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Évalue le risque d'une juridiction saisie en texte libre.
 * Tolérant aux variantes courantes ; sinon renvoie "none".
 */
export function assessJurisdiction(country: string): JurisdictionRisk {
  const n = normalize(country);
  if (!n) return "none";
  if (APPEL_ACTION.has(n)) return "high";
  if (SURVEILLANCE_RENFORCEE.has(n)) return "monitored";
  // Correspondance partielle prudente (ex. « Iran, Rép. islamique d' »).
  for (const c of APPEL_ACTION) if (n.includes(c)) return "high";
  for (const c of SURVEILLANCE_RENFORCEE) if (n.includes(c)) return "monitored";
  return "none";
}

export const JURISDICTION_LABEL: Record<JurisdictionRisk, string> = {
  none: "Hors liste GAFI",
  monitored: "Surveillance renforcée (liste grise)",
  high: "Appel à l'action (liste noire)",
};

/* ── Garde-fou de péremption ─────────────────────────────────────────────── */

/** Âge du snapshot en mois (arrondi au mois), à une date donnée. */
export function gafiSnapshotAgeMonths(now: Date = new Date()): number {
  const snap = new Date(GAFI_SNAPSHOT_ISO);
  const months =
    (now.getFullYear() - snap.getFullYear()) * 12 +
    (now.getMonth() - snap.getMonth());
  return Math.max(0, months);
}

/**
 * Le snapshot GAFI est-il périmé (plus vieux que ~2 plénières) ? Dans ce cas,
 * l'app doit afficher un avertissement : les listes ont probablement changé.
 */
export function isGafiSnapshotStale(now: Date = new Date()): boolean {
  return gafiSnapshotAgeMonths(now) >= GAFI_SNAPSHOT_MAX_AGE_MONTHS;
}
