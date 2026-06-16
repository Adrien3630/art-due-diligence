/*
  Couche d'accès au screening, côté client.
  En web : appelle la route Next /api/screening.
  En Tauri : remplacer le corps de `runScreening` par un invoke() de la
  commande Rust équivalente (même contrat d'entrée/sortie).
*/

import type {
  BeneficialOwner,
  ScreeningResult,
  ScreeningSubject,
  Settings,
} from "./types";

export type ScreeningCred = Pick<Settings, "fournisseur" | "apiKey">;

export async function runScreening(
  subject: ScreeningSubject,
  settings: ScreeningCred,
): Promise<ScreeningResult> {
  try {
    const res = await fetch("/api/screening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, settings }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ScreeningResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return {
      sujet: [subject.prenoms, subject.nom].filter(Boolean).join(" "),
      status: "error",
      matches: [],
      listesInterrogees: [],
      fournisseur: settings.fournisseur,
      horodatage: new Date().toISOString(),
      desambiguise: false,
      message: `Appel impossible : ${message}`,
    };
  }
}

/**
 * Aplatit l'arbre des bénéficiaires effectifs (cascade) en sujets de screening :
 * chaque nœud (personne OU entité intermédiaire) est screené, en profondeur.
 */
export function collectBeneficiarySubjects(
  bens: BeneficialOwner[],
): ScreeningSubject[] {
  const out: ScreeningSubject[] = [];
  for (const b of bens) {
    if (b.nom.trim()) {
      out.push({
        kind: b.kind,
        nom: b.nom,
        prenoms: b.prenoms,
        nationalite: b.nationalite,
      });
    }
    if (b.kind === "entite") {
      out.push(...collectBeneficiarySubjects(b.beneficiaires));
    }
  }
  return out;
}

/** Construit un sujet de screening à partir d'un acteur. */
export function subjectFromActor(actor: {
  kind: ScreeningSubject["kind"];
  nom: string;
  prenoms?: string;
  dateNaissance?: string;
  nationalite?: string;
  pays?: string;
}): ScreeningSubject {
  return {
    kind: actor.kind,
    nom: actor.nom,
    prenoms: actor.prenoms,
    dateNaissance: actor.dateNaissance,
    nationalite: actor.nationalite,
    pays: actor.pays,
  };
}
