/*
  Autocomplétion & pré-remplissage — mémoire locale chiffrée.

  Gain de temps sur la saisie récurrente : dès qu'un champ connu est édité, on
  propose les valeurs DÉJÀ enregistrées dans les dossiers précédents (artistes,
  nationalités, pays, techniques, catégories…). Les champs administratifs stables
  (galerie, signataire) sont pré-remplis depuis les réglages.

  HONNÊTETÉ : ce ne sont que des SUGGESTIONS issues du coffre de l'utilisateur —
  aucune source externe, aucune invention. Fonctions PURES (historique/réglages
  passés en argument) → testables.
*/

import { normalize } from "./antecedents";
import type { Actor, Dossier, Settings } from "./types";

/** Champs pour lesquels on sait proposer des valeurs déjà vues. */
export type SuggestField =
  | "artiste"
  | "nationalite"
  | "pays"
  | "technique"
  | "formeJuridique";

function actorsOf(d: Dossier): Actor[] {
  if (d.kind === "acteur") return [d.actor];
  if (d.kind === "transaction")
    return [d.acheteur?.actor, d.vendeur?.actor].filter((a): a is Actor => a != null);
  return [];
}

/** Toutes les valeurs non vides observées pour un champ, dédoublonnées. */
function collect(history: Dossier[], field: SuggestField): string[] {
  const seen = new Map<string, string>(); // clé normalisée → 1re forme vue
  const add = (v: string | undefined) => {
    const val = v?.trim();
    if (!val) return;
    const k = normalize(val);
    if (k && !seen.has(k)) seen.set(k, val);
  };

  for (const d of history) {
    if (field === "artiste" || field === "technique") {
      const art = d.kind === "oeuvre" ? d.artwork : d.kind === "transaction" ? d.oeuvre.artwork : null;
      if (art) add(field === "artiste" ? art.artiste : art.technique);
      continue;
    }
    for (const a of actorsOf(d)) {
      if (field === "nationalite") add(a.nationalite);
      else if (field === "pays") add(a.pays);
      else if (field === "formeJuridique") add(a.formeJuridique);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Suggestions pour un champ, filtrées par le début de saisie (`query`) et triées
 * par pertinence (préfixe d'abord). `query` vide → liste complète (max `limit`).
 */
export function suggest(
  history: Dossier[],
  field: SuggestField,
  query = "",
  limit = 8,
): string[] {
  const all = collect(history, field);
  const q = normalize(query);
  if (!q) return all.slice(0, limit);
  const scored = all
    .map((v) => ({ v, n: normalize(v) }))
    .filter((x) => x.n.includes(q))
    .sort((a, b) => {
      const ap = a.n.startsWith(q) ? 0 : 1;
      const bp = b.n.startsWith(q) ? 0 : 1;
      return ap - bp || a.v.localeCompare(b.v, "fr");
    });
  return scored.map((x) => x.v).slice(0, limit);
}

/** Valeurs administratives à pré-remplir à la création d'un dossier. */
export interface Prefill {
  nomGalerie: string;
  signataire: string;
}

export function prefillFromSettings(settings: Settings): Prefill {
  return {
    nomGalerie: settings.nomGalerie?.trim() ?? "",
    signataire: settings.signataire?.trim() ?? "",
  };
}
