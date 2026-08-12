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
  // true = l'URL injecte vraiment la recherche (artiste + titre).
  // false = le site n'a pas d'URL de recherche fiable → l'humain saisit
  //         lui-même les termes (qu'on lui affiche pour éviter toute erreur).
  prefilled: boolean;
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
      "Base mondiale des biens culturels volés. Pas d'API ; recherche via l'app ID-Art ou après inscription. Saisissez les termes vous-même.",
    buildUrl: () =>
      "https://www.interpol.int/fr/Notre-action/Bases-de-donnees/Base-de-donnees-des-oeuvres-d-art-volees",
    prefilled: false,
  },
  {
    id: "art_loss_register",
    registre: "Art Loss Register",
    kind: "vol",
    description:
      "Plus grande base privée d'œuvres volées/spoliées. Recherche commerciale (payante), saisie manuelle.",
    buildUrl: () => "https://www.artloss.com/services/single-search/",
    prefilled: false,
  },
  {
    id: "fbi_nsaf",
    registre: "FBI — National Stolen Art File",
    kind: "vol",
    description: "Base publique du FBI (œuvres volées, juridiction US). Saisie manuelle.",
    buildUrl: () => "https://www.fbi.gov/investigate/violent-crime/art-theft/national-stolen-art-file",
    prefilled: false,
  },
];

/** Registres de SPOLIATION (notamment période 1933-1945). */
const SPOLIATION: RegisterDef[] = [
  {
    id: "lostart_de",
    registre: "Lost Art Database (Allemagne)",
    kind: "spoliation",
    description:
      "Base de référence des biens culturels spoliés sous le national-socialisme. Recherche pré-remplie.",
    buildUrl: (a) =>
      `https://www.lostart.de/fr/recherche?searchterm=${encodeURIComponent(q(a))}`,
    prefilled: true,
  },
  {
    id: "mnr_rose_valland",
    registre: "MNR / Rose-Valland (France)",
    kind: "spoliation",
    description:
      "Musées Nationaux Récupération : œuvres récupérées après-guerre, en dépôt dans les musées français. Recherche pré-remplie.",
    buildUrl: (a) =>
      `https://www.pop.culture.gouv.fr/search/list?mainSearch=${encodeURIComponent(q(a))}`,
    prefilled: true,
  },
  {
    id: "err_project",
    registre: "ERR Project (Jeu de Paume)",
    kind: "spoliation",
    description:
      "Base du pillage par l'Einsatzstab Reichsleiter Rosenberg en France et Belgique. Saisie manuelle.",
    buildUrl: () => "https://www.errproject.org/jeudepaume/",
    prefilled: false,
  },
  {
    id: "central_registry",
    registre: "Central Registry of Looted Art (1933-1945)",
    kind: "spoliation",
    description: "Registre international des œuvres spoliées et revendiquées. Saisie manuelle.",
    buildUrl: () => "https://www.lootedart.com/web_images/pdf2014/search.html",
    prefilled: false,
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

/** Le lien de ce registre injecte-t-il vraiment la recherche ? */
export function isPrefilled(id: string): boolean {
  return ALL.find((r) => r.id === id)?.prefilled ?? false;
}

/** Termes de recherche à utiliser (affichés à l'humain pour la saisie manuelle). */
export function registerSearchTerms(a: Pick<Artwork, "artiste" | "titre">): string {
  return q(a);
}

export const REGISTER_RESULT_LABEL: Record<RegisterCheck["resultat"], string> = {
  non_verifie: "Non vérifié",
  aucune: "Aucune correspondance",
  correspondance: "Correspondance trouvée",
};

/* ── Attestation de revue (honnête) ─────────────────────────────────── */

export interface RegisterReview {
  total: number;
  constates: number; // résultats renseignés (aucune | correspondance)
  restants: number; // encore « non vérifié »
  correspondances: number;
  tousConstates: boolean;
}

/** Synthèse de l'avancement de la revue des registres. */
export function registerReview(checks: RegisterCheck[]): RegisterReview {
  const constates = checks.filter((c) => c.resultat !== "non_verifie").length;
  const correspondances = checks.filter((c) => c.resultat === "correspondance").length;
  return {
    total: checks.length,
    constates,
    restants: checks.length - constates,
    correspondances,
    tousConstates: checks.length > 0 && constates === checks.length,
  };
}

/**
 * Détail d'audit d'une ATTESTATION DE REVUE — l'humain déclare avoir consulté
 * chaque registre et constaté les résultats. On n'invente rien : le texte
 * reprend exactement ce qui a été constaté, registre par registre.
 */
export function attestationDetail(checks: RegisterCheck[], signataire: string): string {
  const nom = signataire.trim() || "[signataire]";
  const lignes = checks
    .map((c) => `${c.registre} : ${REGISTER_RESULT_LABEL[c.resultat]}`)
    .join(" ; ");
  return `Revue des registres attestée par ${nom}. ${lignes}.`;
}
