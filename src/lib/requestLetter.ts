/*
  Génération d'une demande de pièces PRÉ-REMPLIE.

  Objectif produit : éviter au galeriste l'interrogatoire oral gênant. Quand une
  pièce est légalement due, on produit un courriel/courrier neutre, justifié par
  l'obligation LCB-FT (et non par une suspicion personnelle), que le galeriste
  envoie LUI-MÊME. L'outil n'envoie rien : il prépare un brouillon local.
*/

import type { Actor, CollectionItem, Settings } from "./types";

function destinataire(actor: Actor): string {
  if (actor.kind === "entite") return actor.nom || "Madame, Monsieur";
  const nom = [actor.prenoms, actor.nom].filter(Boolean).join(" ");
  return nom || "Madame, Monsieur";
}

export interface DraftLetter {
  objet: string;
  corps: string;
}

/** Construit le brouillon de demande pour une liste de pièces. */
export function buildRequestLetter(
  actor: Actor,
  pieces: CollectionItem[],
  settings: Pick<Settings, "nomGalerie" | "signataire">,
): DraftLetter {
  const galerie = settings.nomGalerie?.trim() || "[Nom de la galerie]";
  const signataire = settings.signataire?.trim() || "[Nom et qualité du signataire]";
  const liste = pieces.map((p) => `  • ${p.label}`).join("\n");

  const objet = `${galerie} — Vérifications réglementaires préalables à la transaction`;

  const corps = `Madame, Monsieur ${
    actor.kind === "entite" ? `(${destinataire(actor)})` : destinataire(actor)
  },

Dans le cadre de la finalisation de votre transaction, ${galerie} est tenue, en
application de la réglementation relative à la lutte contre le blanchiment et le
financement du terrorisme (LCB-FT) applicable au marché de l'art, de procéder à
quelques vérifications préalables.

Il ne s'agit en aucun cas d'une remise en cause de votre personne : cette
formalité s'applique de manière identique à l'ensemble de notre clientèle dès
lors que les seuils ou critères réglementaires sont atteints.

Nous vous serions reconnaissants de bien vouloir nous transmettre, à votre
convenance, le ou les éléments suivants :

${liste}

Ces informations sont conservées de manière confidentielle et utilisées aux
seules fins des obligations légales précitées.

Nous restons à votre entière disposition pour tout complément et vous remercions
par avance de votre compréhension.

Bien cordialement,

${signataire}
${galerie}`;

  return { objet, corps };
}

/** Lien mailto pré-rempli (le galeriste choisit d'envoyer ou non). */
export function mailtoHref(draft: DraftLetter): string {
  const params = new URLSearchParams({
    subject: draft.objet,
    body: draft.corps,
  });
  return `mailto:?${params.toString()}`;
}

/** Télécharge le brouillon en fichier texte local. */
export function downloadLetter(draft: DraftLetter, actor: Actor): void {
  const safe =
    (actor.nom || "destinataire").replace(/[^\p{L}\p{N}]+/gu, "_") || "destinataire";
  const content = `Objet : ${draft.objet}\n\n${draft.corps}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `demande_pieces_${safe}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
