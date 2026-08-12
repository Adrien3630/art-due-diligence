/*
  Screening POSSÉDÉ — appariement local contre les listes officielles.

  Pourquoi : le screening de sanctions/gels est la partie la plus DURE
  juridiquement de la LCB-FT, et les listes qui font foi sont GRATUITES et
  publiques (UE, ONU, OFAC, Registre national des gels — DG Trésor). On peut donc
  les apparier EN LOCAL, sans abonnement et sans qu'aucun nom ne quitte la
  machine. Seuls les PPE et l'adverse media (payants, difficiles) restent un
  enrichissement optionnel via un fournisseur.

  HONNÊTETÉ (cruciale) : un snapshot « graine » (démonstration, incomplet) ne
  produit JAMAIS un « aucune correspondance » probant — sinon ce serait une
  fausse assurance. Sans les listes complètes installées, un non-match est
  explicitement NON PROBANT. Fonctions PURES (snapshot injecté) → testables.
*/

import { classifyMatches } from "./classify";
import { similarity } from "./antecedents";
import type { ScreeningMatch, ScreeningResult, ScreeningSubject } from "./types";

/** Une entrée de liste de sanctions/gels, normalisée. */
export interface SanctionEntry {
  id: string;
  nom: string; // nom principal
  alias?: string[]; // AKA / graphies alternatives
  type: "personne" | "entite";
  listes: string[]; // ex. ["UE", "ONU", "OFAC SDN", "Gels FR"]
  pays?: string;
  naissance?: string; // année ou date (désambiguïsation personnes)
  programme?: string; // programme de sanction
}

/** Un instantané daté des listes officielles. */
export interface SanctionsSnapshot {
  version: string; // ISO court, ex. "2026-08-12"
  source: string; // description lisible
  listes: string[]; // listes couvertes (pour « listes interrogées »)
  // true = GRAINE de démonstration (incomplète) : un non-match n'est pas probant.
  seed: boolean;
  entries: SanctionEntry[];
}

/** Seuil d'appariement par défaut (au-dessus → correspondance candidate). */
export const SANCTION_MATCH_THRESHOLD = 0.86;

function subjectName(s: ScreeningSubject): string {
  return [s.prenoms, s.nom].filter(Boolean).join(" ").trim();
}

/** Année (4 chiffres) extraite d'une date/année, sinon null. */
function year(v?: string): number | null {
  const m = v?.match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/**
 * Correspondances d'un sujet dans un snapshot (nom + alias, tolérant aux
 * fautes/variantes). Pour une personne, une année de naissance présente des DEUX
 * côtés mais différente écarte la correspondance (désambiguïsation).
 */
export function matchSanctions(
  subject: ScreeningSubject,
  snapshot: SanctionsSnapshot,
  threshold = SANCTION_MATCH_THRESHOLD,
): ScreeningMatch[] {
  const name = subjectName(subject);
  if (!name) return [];
  const subYear = year(subject.dateNaissance);

  const out: ScreeningMatch[] = [];
  for (const e of snapshot.entries) {
    const names = [e.nom, ...(e.alias ?? [])];
    const score = Math.max(...names.map((n) => similarity(name, n)));
    if (score < threshold) continue;

    // Désambiguïsation par année de naissance (personnes).
    if (e.type === "personne") {
      const eYear = year(e.naissance);
      if (subYear && eYear && subYear !== eYear) continue;
    }

    out.push({
      nom: e.nom,
      listes: e.listes,
      type: e.programme ? `Sanction — ${e.programme}` : "Sanction",
      score: Math.round(score * 100),
      pays: e.pays,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Résultat de screening par appariement LOCAL. Honnête sur la portée :
 *  • correspondance → statut « sanction » ;
 *  • aucun match sur un snapshot COMPLET → « clear » (probant) ;
 *  • aucun match sur une GRAINE (seed) → « demo » NON probant, message explicite.
 */
export function localScreening(
  subject: ScreeningSubject,
  snapshot: SanctionsSnapshot,
): ScreeningResult {
  const matches = matchSanctions(subject, snapshot);
  const base = {
    sujet: subjectName(subject),
    matches,
    listesInterrogees: snapshot.listes,
    fournisseur: `Listes officielles (${snapshot.version})`,
    horodatage: new Date().toISOString(),
    desambiguise: Boolean(subject.dateNaissance || subject.nationalite),
  };

  if (matches.length) {
    return { ...base, status: classifyMatches(matches) };
  }
  if (snapshot.seed) {
    return {
      ...base,
      status: "demo",
      message:
        "Snapshot de DÉMONSTRATION (graine) — les listes officielles complètes ne " +
        "sont pas installées. Ce « aucune correspondance » est NON PROBANT. Importez " +
        "un snapshot officiel à jour pour un screening opposable.",
    };
  }
  return {
    ...base,
    status: "clear",
    message: `Aucune correspondance sur les listes officielles installées (${snapshot.listes.join(", ")}).`,
  };
}

/* ── Fraîcheur du snapshot (les listes bougent souvent) ─────────────── */

export const SANCTIONS_MAX_AGE_DAYS = 30;

export function snapshotAgeDays(snapshot: SanctionsSnapshot, now = new Date()): number {
  const d = new Date(snapshot.version);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

/** Le snapshot est-il périmé (ancienneté > seuil, ou graine) ? */
export function isSanctionsSnapshotStale(
  snapshot: SanctionsSnapshot,
  now = new Date(),
  maxDays = SANCTIONS_MAX_AGE_DAYS,
): boolean {
  return snapshot.seed || snapshotAgeDays(snapshot, now) > maxDays;
}
