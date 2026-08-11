/*
  Pré-remplissage d'une DÉCLARATION DE SOUPÇON (Tracfin).

  Génère un PROJET local, structuré comme une DS, à partir des facteurs de risque
  déjà retenus dans le dossier. Le professionnel le relit, le complète et le
  dépose LUI-MÊME sur le téléservice officiel ERMES. L'outil n'envoie rien et
  rappelle de NE PAS transmettre une DS par e-mail.
*/

import type { Actor, Dossier, RiskLevel, Settings } from "./types";

const NIVEAU_LABEL: Record<RiskLevel, string> = {
  faible: "faible",
  vigilance: "vigilance",
  eleve: "élevé",
};

export interface TracfinDraft {
  objet: string;
  corps: string;
}

function actorLine(a: Actor): string {
  if (a.kind === "entite") {
    return `${a.nom || "[raison sociale]"} (${a.formeJuridique || "forme juridique ?"}), immatriculation ${a.immatriculation || "?"}, juridiction ${a.pays || "?"}`;
  }
  const nom = [a.prenoms, a.nom].filter(Boolean).join(" ") || "[identité]";
  const naissance = a.dateNaissance ? `né(e) le ${a.dateNaissance}` : "naissance ?";
  return `${nom}, ${naissance}, nationalité ${a.nationalite || "?"}, résidant en ${a.pays || "?"}`;
}

/** Extrait les éléments pertinents selon le type de dossier. */
function extract(dossier: Dossier): {
  personnes: string[];
  operation: string;
  facteurs: string[];
  niveau: RiskLevel;
} {
  if (dossier.kind === "acteur") {
    return {
      personnes: [actorLine(dossier.actor)],
      operation: "Relation d'affaires / opération sur le marché de l'art.",
      facteurs: dossier.assessment.facteurs,
      niveau: dossier.assessment.niveau,
    };
  }
  if (dossier.kind === "oeuvre") {
    const a = dossier.artwork;
    return {
      personnes: ["— (dossier centré sur l'œuvre, parties non renseignées ici)"],
      operation: `Œuvre : ${a.titre || "—"}${a.artiste ? ` — ${a.artiste}` : ""}${a.annee ? ` (${a.annee})` : ""}.`,
      facteurs: dossier.assessment.facteurs,
      niveau: dossier.assessment.niveau,
    };
  }
  const personnes = [actorLine(dossier.acheteur.actor)];
  if (dossier.vendeur) personnes.push(actorLine(dossier.vendeur.actor));
  const a = dossier.oeuvre.artwork;
  const montant =
    dossier.montantEur != null ? ` Montant : ${dossier.montantEur.toLocaleString("fr-FR")} €.` : "";
  return {
    personnes,
    operation: `Transaction sur l'œuvre « ${a.titre || "—"} »${a.artiste ? ` de ${a.artiste}` : ""}.${montant}`,
    facteurs: dossier.facteurs,
    niveau: dossier.niveau,
  };
}

export function buildTracfinDraft(
  dossier: Dossier,
  settings: Pick<Settings, "nomGalerie" | "signataire">,
): TracfinDraft {
  const galerie = settings.nomGalerie?.trim() || "[Nom de la galerie]";
  const signataire = settings.signataire?.trim() || "[Déclarant — nom et qualité]";
  const { personnes, operation, facteurs, niveau } = extract(dossier);
  const date = new Date(dossier.date).toLocaleString("fr-FR");

  const objet = `PROJET de déclaration de soupçon — dossier ${dossier.id}`;

  const corps = `PROJET DE DÉCLARATION DE SOUPÇON (Tracfin)
À relire, compléter, puis DÉPOSER sur le téléservice ERMES.
⚠️ Une déclaration de soupçon ne se transmet JAMAIS par e-mail.

Référence dossier : ${dossier.id}
Date d'établissement : ${date}
Niveau de risque évalué : ${NIVEAU_LABEL[niveau]}

I. DÉCLARANT
${galerie}
Personne responsable : ${signataire}

II. PERSONNE(S) CONCERNÉE(S)
${personnes.map((p) => `  • ${p}`).join("\n")}

III. OPÉRATION
${operation}

IV. EXPOSÉ DES FAITS ET RAISONS DU SOUPÇON
Les éléments de vigilance suivants ont été relevés au cours de la due diligence :
${facteurs.map((f) => `  – ${f}`).join("\n")}

${
  dossier.decision
    ? `V. DÉCISION DU PROFESSIONNEL\n  ${dossier.decision.motif || "(motif à compléter)"}\n  — ${dossier.decision.signataire}`
    : "V. DÉCISION DU PROFESSIONNEL\n  (à compléter)"
}

— Document de travail généré localement. Aucune valeur tant qu'il n'est pas
déposé sur ERMES par le déclarant.`;

  return { objet, corps };
}

/** Télécharge le projet de DS en fichier texte local. */
export function downloadTracfin(draft: TracfinDraft, dossier: Dossier): void {
  const content = `${draft.objet}\n\n${draft.corps}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `projet_declaration_soupcon_${dossier.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
