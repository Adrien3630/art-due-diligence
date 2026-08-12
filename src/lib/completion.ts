/*
  Jauge de complétion du dossier — indicateur d'ergonomie.

  Donne au galeriste une vue instantanée de ce qui reste à faire pour un dossier
  DÉFENDABLE, et la prochaine étape à franchir (« Origine des fonds à
  documenter »). Le niveau de complétion s'adapte au niveau de vigilance retenu
  (simplifiée / standard / renforcée) : on n'exige que le minimum réellement dû.

  HONNÊTETÉ : la jauge ne reflète que des éléments OBSERVABLES dans le modèle
  (champs saisis, pièce téléversée, registres constatés). Elle n'affirme jamais
  qu'une pièce hors-outil a été obtenue. Les pièces à recueillir non observables
  (origine des fonds…) restent listées comme « à documenter » tant que l'humain
  ne les a pas rattachées. Fonctions PURES → testables.
*/

import type { Actor, ActorAssessment, Artwork } from "./types";

export interface CompletionItem {
  id: string;
  label: string;
  done: boolean;
  motif?: string; // pourquoi c'est attendu (aide contextuelle)
}

export interface Completion {
  done: number;
  total: number;
  pct: number; // 0..100
  items: CompletionItem[];
  nextStep: string | null; // libellé du premier élément manquant
}

function finalize(items: CompletionItem[]): Completion {
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 100;
  const next = items.find((i) => !i.done);
  return { done, total: items.length, pct, items, nextStep: next?.label ?? null };
}

/* ── Acteur ─────────────────────────────────────────────────────────── */

export function actorCompletion(
  actor: Actor,
  assessment: ActorAssessment,
): Completion {
  const items: CompletionItem[] = [];
  const has = (v: string) => v.trim().length > 0;

  items.push({
    id: "nom",
    label: actor.kind === "entite" ? "Raison sociale" : "Nom",
    done: has(actor.nom),
  });

  if (actor.kind === "personne") {
    items.push({ id: "prenoms", label: "Prénom(s)", done: has(actor.prenoms) });
    items.push({ id: "naissance", label: "Date de naissance", done: has(actor.dateNaissance) });
    items.push({ id: "nationalite", label: "Nationalité", done: has(actor.nationalite) });
    items.push({ id: "pays", label: "Pays de résidence", done: has(actor.pays) });
  } else {
    items.push({ id: "immatriculation", label: "Immatriculation", done: has(actor.immatriculation) });
    items.push({ id: "pays", label: "Juridiction", done: has(actor.pays) });
    items.push({
      id: "ubo",
      label: "Bénéficiaire(s) effectif(s) déclaré(s)",
      done: actor.beneficiaires.length > 0,
      motif: "Transparence de la structure.",
    });
  }

  // Pièces dues au titre de la vigilance retenue (aucune si simplifiée).
  for (const p of assessment.piecesACollecter) {
    const done = p.id === "identite" ? actor.pieceIdentiteDoc != null : false;
    items.push({ id: `piece_${p.id}`, label: p.label, done, motif: p.motif });
  }

  return finalize(items);
}

/* ── Œuvre ──────────────────────────────────────────────────────────── */

export function artworkCompletion(artwork: Artwork): Completion {
  const items: CompletionItem[] = [];
  const has = (v: string) => v.trim().length > 0;

  items.push({ id: "titre", label: "Titre", done: has(artwork.titre) });
  items.push({ id: "artiste", label: "Artiste", done: has(artwork.artiste) });
  items.push({
    id: "provenance",
    label: "Chaîne de provenance (≥ 1 maillon)",
    done: artwork.provenance.some((p) => p.proprietaire.trim().length > 0),
    motif: "Documenter la succession des propriétaires.",
  });

  const registresRestants = artwork.registres.filter((r) => r.resultat === "non_verifie").length;
  items.push({
    id: "registres",
    label: `Registres vol / spoliation vérifiés (${artwork.registres.length - registresRestants}/${artwork.registres.length})`,
    done: registresRestants === 0,
    motif: "Constater chaque registre avant de conclure.",
  });

  const redFlagsRestants = artwork.redFlags.filter((a) => a.reponse === null).length;
  items.push({
    id: "red_flags",
    label: "Indicateurs de risque GAFI passés en revue",
    done: redFlagsRestants === 0,
    motif: "Répondre aux indicateurs du marché de l'art.",
  });

  return finalize(items);
}

/* ── Transaction (agrégat) ──────────────────────────────────────────── */

export interface TransactionParts {
  montantEur: number | null;
  acheteur: { actor: Actor; assessment: ActorAssessment } | null;
  vendeur: { actor: Actor; assessment: ActorAssessment } | null;
  oeuvre: Artwork;
}

export function transactionCompletion(parts: TransactionParts): Completion {
  const items: CompletionItem[] = [];
  items.push({
    id: "montant",
    label: "Montant de l'opération",
    done: parts.montantEur != null && parts.montantEur > 0,
  });

  if (parts.acheteur)
    items.push(...prefix("acheteur", "Acheteur", actorCompletion(parts.acheteur.actor, parts.acheteur.assessment)));
  if (parts.vendeur)
    items.push(...prefix("vendeur", "Vendeur", actorCompletion(parts.vendeur.actor, parts.vendeur.assessment)));
  items.push(...prefix("oeuvre", "Œuvre", artworkCompletion(parts.oeuvre)));

  return finalize(items);
}

function prefix(ns: string, label: string, c: Completion): CompletionItem[] {
  return c.items.map((i) => ({ ...i, id: `${ns}_${i.id}`, label: `${label} — ${i.label}` }));
}
