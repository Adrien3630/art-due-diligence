/*
  Référentiel des registres d'œuvres volées et spoliées.

  HONNÊTETÉ (essentielle pour un outil de conformité) :
  La plupart de ces bases n'exposent PAS d'API ouverte. On ne peut donc pas
  « cocher automatiquement » une vérification. Ce que l'outil fait :
   1. construit un lien de recherche PRÉ-REMPLI (artiste + titre) vers chaque
      registre ;
   2. laisse le galeriste CONSTATER le résultat et l'enregistrer (tracé,
      horodaté) ;
   3. n'affiche JAMAIS un « rien à signaler » qui n'aurait pas été constaté.

  Brancher en réel les rares sources dotées d'une API (ex. Interpol ID-Art)
  relève d'une étape ultérieure ; le contrat de données ne change pas.
*/

import type { Artwork, RegisterCheck, RegisterKind } from "./types";

interface RegisterDef {
  id: string;
  registre: string;
  kind: RegisterKind;
  // Construit l'URL de recherche, pré-remplie quand le site le permet.
  buildUrl: (a: Pick<Artwork, "artiste" | "titre">) => string;
  description: string;
}

function q(a: Pick<Artwork, "artiste" | "titre">): string {
  return [a.artiste, a.titre].filter(Boolean).join(" ").trim();
}

/** Registres d'œuvres VOLÉES. */
const VOL: RegisterDef[] = [
  {
    id: "interpol",
    registre: "Interpol — Œuvres d'art volées (ID-Art)",
    kind: "vol",
    description:
      "Base mondiale des biens culturels volés. Accès public après inscription.",
    buildUrl: () =>
      "https://www.interpol.int/fr/Notre-action/Bases-de-donnees/Base-de-donnees-des-oeuvres-d-art-volees",
  },
  {
    id: "art_loss_register",
    registre: "Art Loss Register",
    kind: "vol",
    description:
      "Plus grande base privée d'œuvres volées/spoliées. Recherche commerciale (payante).",
    buildUrl: () => "https://www.artloss.com/services/single-search/",
  },
  {
    id: "fbi_nsaf",
    registre: "FBI — National Stolen Art File",
    kind: "vol",
    description: "Base publique du FBI (œuvres volées, juridiction US).",
    buildUrl: () => "https://www.fbi.gov/investigate/violent-crime/art-theft/national-stolen-art-file",
  },
];

/** Registres de SPOLIATION (notamment période 1933-1945). */
const SPOLIATION: RegisterDef[] = [
  {
    id: "lostart_de",
    registre: "Lost Art Database (Allemagne)",
    kind: "spoliation",
    description:
      "Base de référence des biens culturels spoliés sous le national-socialisme.",
    buildUrl: (a) =>
      `https://www.lostart.de/fr/recherche?searchterm=${encodeURIComponent(q(a))}`,
  },
  {
    id: "mnr_rose_valland",
    registre: "MNR / Rose-Valland (France)",
    kind: "spoliation",
    description:
      "Musées Nationaux Récupération : œuvres récupérées après-guerre, en dépôt dans les musées français.",
    buildUrl: (a) =>
      `https://www.pop.culture.gouv.fr/search/list?mainSearch=${encodeURIComponent(q(a))}`,
  },
  {
    id: "err_project",
    registre: "ERR Project (Jeu de Paume)",
    kind: "spoliation",
    description:
      "Base du pillage par l'Einsatzstab Reichsleiter Rosenberg en France et Belgique.",
    buildUrl: () => "https://www.errproject.org/jeudepaume/",
  },
  {
    id: "central_registry",
    registre: "Central Registry of Looted Art (1933-1945)",
    kind: "spoliation",
    description: "Registre international des œuvres spoliées et revendiquées.",
    buildUrl: () => "https://www.lootedart.com/web_images/pdf2014/search.html",
  },
];

const ALL: RegisterDef[] = [...VOL, ...SPOLIATION];

/** Construit la liste vierge des vérifications registres pour une œuvre. */
export function freshRegisterChecks(): RegisterCheck[] {
  return ALL.map((r) => ({
    id: r.id,
    registre: r.registre,
    kind: r.kind,
    url: r.buildUrl({ artiste: "", titre: "" }),
    resultat: "non_verifie" as const,
  }));
}

/** Recalcule les URLs pré-remplies à partir de l'identité de l'œuvre. */
export function withPrefilledUrls(
  checks: RegisterCheck[],
  a: Pick<Artwork, "artiste" | "titre">,
): RegisterCheck[] {
  const byId = new Map(ALL.map((d) => [d.id, d]));
  return checks.map((c) => {
    const def = byId.get(c.id);
    return def ? { ...c, url: def.buildUrl(a) } : c;
  });
}

/** Description lisible d'un registre (pour l'UI). */
export function registerDescription(id: string): string {
  return ALL.find((r) => r.id === id)?.description ?? "";
}

export const REGISTER_RESULT_LABEL: Record<RegisterCheck["resultat"], string> = {
  non_verifie: "Non vérifié",
  aucune: "Aucune correspondance",
  correspondance: "Correspondance trouvée",
};
