/*
  Snapshot GRAINE des listes officielles — DÉMONSTRATION, incomplet.

  Ce fichier n'est PAS les listes de sanctions complètes. C'est une graine qui
  prouve le mécanisme d'appariement local et permet de visualiser une
  correspondance. `seed: true` garantit qu'un non-match reste NON PROBANT tant que
  les listes officielles complètes ne sont pas installées.

  Alimentation en production (hors de cet outil) : ingérer périodiquement les
  fichiers officiels — UE (liste consolidée), ONU (Consolidated List), OFAC (SDN)
  et le Registre national des gels (DG Trésor) — dans ce même format, signés, et
  les distribuer aux postes. Le contrat de données ne change pas.
*/

import type { SanctionsSnapshot } from "./sanctions";

export const SEED_SNAPSHOT: SanctionsSnapshot = {
  version: "2026-08-12",
  source:
    "Graine de démonstration (non exhaustive). Remplacer par un snapshot officiel " +
    "signé issu de l'UE / ONU / OFAC / Registre national des gels.",
  listes: ["UE (consolidée)", "ONU", "OFAC SDN", "Gels FR (DG Trésor)"],
  seed: true,
  entries: [
    {
      id: "specimen-1",
      nom: "SPECIMEN Sanctionné",
      alias: ["SPECIMEN Sanctionne", "Le Specimen"],
      type: "personne",
      listes: ["UE (consolidée)", "OFAC SDN"],
      pays: "—",
      naissance: "1970",
      programme: "SPÉCIMEN (démonstration)",
    },
    {
      id: "specimen-2",
      nom: "SPECIMEN Holding Ltd",
      alias: ["Specimen Holding Limited"],
      type: "entite",
      listes: ["ONU", "Gels FR (DG Trésor)"],
      pays: "—",
      programme: "SPÉCIMEN (démonstration)",
    },
  ],
};

/**
 * Charge le snapshot des listes officielles utilisé pour l'appariement local.
 * Aujourd'hui : la graine embarquée. Point d'extension : fusionner ici un
 * snapshot officiel importé/distribué (conservé chiffré au coffre).
 */
export function loadSanctionsSnapshot(): SanctionsSnapshot {
  return SEED_SNAPSHOT;
}
