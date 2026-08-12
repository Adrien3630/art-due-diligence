/*
  Établi de travail — bascule inter-modules avec conservation d'état (#4).

  Permet d'envoyer un acteur ou une œuvre en cours de saisie vers le module
  Transaction sans re-saisir. Même principe que `reopen.ts` : une variable de
  module survit à la navigation client-side de Next ; rien n'est écrit sur le
  disque. Un seul usage (consommé au montage de la cible).
*/

import type { Actor, Artwork } from "./types";

interface Workbench {
  actor?: Actor;
  artwork?: Artwork;
}

let pending: Workbench | null = null;

/** Dépose un acteur et/ou une œuvre pour la prochaine ouverture de Transaction. */
export function setWorkbench(w: Workbench): void {
  pending = w;
}

/** Récupère et consomme l'établi (un seul usage). */
export function takeWorkbench(): Workbench | null {
  const w = pending;
  pending = null;
  return w;
}
