/*
  Référentiel de juridictions à risque (GAFI / FATF).

  But : DÉRIVER le risque-pays automatiquement à partir du pays saisi, au lieu
  de le DEMANDER au galeriste. Une question intrusive de moins.

  ⚠️ HONNÊTETÉ : ces listes sont INDICATIVES et évoluent à chaque plénière du
  GAFI (3×/an). Le snapshot ci-dessous date de février 2025 et DOIT être tenu à
  jour. L'outil le signale ; il ne prétend pas refléter l'état du jour.
*/

export const GAFI_SNAPSHOT_DATE = "février 2025";

/** « Appel à l'action » (liste noire) — risque le plus élevé. */
const APPEL_ACTION = new Set([
  "coree du nord",
  "coree du nord (rpdc)",
  "rpdc",
  "iran",
  "birmanie",
  "myanmar",
]);

/** « Surveillance renforcée » (liste grise) — vigilance accrue. */
const SURVEILLANCE_RENFORCEE = new Set([
  "algerie",
  "angola",
  "bulgarie",
  "burkina faso",
  "cameroun",
  "cote d'ivoire",
  "republique democratique du congo",
  "rd congo",
  "haiti",
  "kenya",
  "laos",
  "liban",
  "mali",
  "monaco",
  "mozambique",
  "namibie",
  "nepal",
  "nigeria",
  "soudan du sud",
  "syrie",
  "tanzanie",
  "venezuela",
  "vietnam",
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
