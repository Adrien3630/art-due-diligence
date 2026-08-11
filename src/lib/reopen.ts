/*
  Relais de RÉOUVERTURE d'un dossier archivé.

  L'historique dépose l'id du dossier à rouvrir, puis navigue (client-side) vers
  l'écran d'analyse correspondant ; celui-ci le « consomme » au montage et
  s'hydrate à partir du dossier. Simple variable de module : la navigation
  client-side de Next conserve le contexte JS, donc l'id survit le temps du saut.
  Aucune donnée n'est écrite sur le disque ici.
*/

import type { DossierKind } from "./types";

let pendingId: string | null = null;

export function setReopen(id: string): void {
  pendingId = id;
}

/** Renvoie l'id à rouvrir (et le consomme : un seul usage). */
export function takeReopen(): string | null {
  const id = pendingId;
  pendingId = null;
  return id;
}

/** Route d'analyse correspondant à un type de dossier. */
export function routeForKind(kind: DossierKind): string {
  return `/${kind}`;
}
