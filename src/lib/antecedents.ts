/*
  Recherche d'antécédents inter-dossiers — 100 % locale, tolérante aux fautes.

  Objectif produit : quand le galeriste saisit un nom d'acteur ou une œuvre,
  lui signaler qu'un dossier PROCHE existe déjà dans l'historique chiffré, même
  en cas de variante orthographique (« Müller » vs « Muller », « J. Dupont » vs
  « Jean Dupont »). Il peut alors réimporter le profil au lieu de tout ressaisir.

  HONNÊTETÉ : on ne « fusionne » jamais deux identités automatiquement. On PROPOSE
  des correspondances probables (score de similarité) ; l'humain reconnaît, ou
  non, qu'il s'agit de la même personne / œuvre. Tout est calculé en mémoire à
  partir du coffre déchiffré — aucune donnée ne sort, aucun index n'est persisté
  en clair.

  Fonctions PURES (l'historique est passé en argument) → entièrement testables.
*/

import type { Actor, Artwork, Dossier } from "./types";

/* ── Normalisation & distance (pur) ─────────────────────────────────── */

/** Minuscule, sans accents ni ponctuation, espaces normalisés. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distance de Levenshtein (nombre d'éditions), itérative O(n·m) mémoire O(m). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Similarité 0..1 entre deux chaînes (1 = identiques après normalisation).
 * Tolère les mots dans le désordre (« Jean Dupont » ≈ « Dupont Jean ») en
 * comparant aussi les jetons triés, et récompense l'inclusion d'un terme court
 * dans un terme long (« dupont » dans « jean dupont »).
 */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const sorted = (s: string) => s.split(" ").sort().join(" ");
  const direct = ratio(na, nb);
  const reordered = ratio(sorted(na), sorted(nb));
  const contained = na.includes(nb) || nb.includes(na) ? 0.9 : 0;
  return Math.max(direct, reordered, contained);
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/* ── Modèle de correspondance ───────────────────────────────────────── */

export interface ActorAntecedent {
  dossierId: string;
  date: string; // ISO (dernière revue sinon création)
  kind: Dossier["kind"];
  nom: string; // libellé lisible du sujet trouvé
  role?: string; // « acheteur » / « vendeur » quand pertinent
  score: number; // 0..1
  actor: Actor; // profil réutilisable (réimport)
}

export interface ArtworkAntecedent {
  dossierId: string;
  date: string;
  nom: string; // « Titre — Artiste »
  score: number;
  artwork: Artwork;
}

const DEFAULT_MIN = 0.72;

function actorLabel(a: Actor): string {
  return a.kind === "entite"
    ? a.nom
    : [a.prenoms, a.nom].filter(Boolean).join(" ").trim() || a.nom;
}

function artworkLabel(a: Artwork): string {
  return [a.titre, a.artiste].filter(Boolean).join(" — ").trim();
}

/** Tous les acteurs présents dans un dossier (0..2 selon le type). */
function actorsOf(d: Dossier): { actor: Actor; role?: string }[] {
  if (d.kind === "acteur") return [{ actor: d.actor }];
  if (d.kind === "transaction") {
    const out: { actor: Actor; role?: string }[] = [];
    if (d.acheteur) out.push({ actor: d.acheteur.actor, role: "acheteur" });
    if (d.vendeur) out.push({ actor: d.vendeur.actor, role: "vendeur" });
    return out;
  }
  return [];
}

function dossierDate(d: Dossier): string {
  return d.derniereRevue ?? d.date;
}

/* ── Recherche (pur) ────────────────────────────────────────────────── */

/**
 * Acteurs de l'historique proches de `query`, triés par score décroissant.
 * `excludeId` retire le dossier courant (édition d'un dossier déjà ouvert).
 */
export function searchActors(
  history: Dossier[],
  query: string,
  opts: { min?: number; excludeId?: string; limit?: number } = {},
): ActorAntecedent[] {
  const min = opts.min ?? DEFAULT_MIN;
  if (normalize(query).length < 2) return [];
  const out: ActorAntecedent[] = [];
  for (const d of history) {
    if (d.id === opts.excludeId) continue;
    for (const { actor, role } of actorsOf(d)) {
      const nom = actorLabel(actor);
      const score = similarity(query, nom);
      if (score >= min) {
        out.push({ dossierId: d.id, date: dossierDate(d), kind: d.kind, nom, role, score, actor });
      }
    }
  }
  return dedupeByLabel(out).sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}

/** Œuvres de l'historique proches de `query` (titre et/ou artiste). */
export function searchArtworks(
  history: Dossier[],
  query: string,
  opts: { min?: number; excludeId?: string; limit?: number } = {},
): ArtworkAntecedent[] {
  const min = opts.min ?? DEFAULT_MIN;
  if (normalize(query).length < 2) return [];
  const out: ArtworkAntecedent[] = [];
  for (const d of history) {
    if (d.id === opts.excludeId) continue;
    const art = d.kind === "oeuvre" ? d.artwork : d.kind === "transaction" ? d.oeuvre.artwork : null;
    if (!art) continue;
    const nom = artworkLabel(art);
    const score = Math.max(
      similarity(query, nom),
      similarity(query, art.titre),
      similarity(query, art.artiste),
    );
    if (score >= min) {
      out.push({ dossierId: d.id, date: dossierDate(d), nom, score, artwork: art });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}

/** Garde la meilleure occurrence par libellé normalisé (évite les doublons). */
function dedupeByLabel(list: ActorAntecedent[]): ActorAntecedent[] {
  const best = new Map<string, ActorAntecedent>();
  for (const item of list) {
    const k = normalize(item.nom);
    const cur = best.get(k);
    if (!cur || item.score > cur.score) best.set(k, item);
  }
  return [...best.values()];
}
