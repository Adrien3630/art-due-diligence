/*
  Moteur de scoring — TRANSPARENT, HONNÊTE, par approche des risques.

  Trois synthèses distinctes :
   • assessActor      : vigilance d'un acteur. Par DÉFAUT vigilance simplifiée,
                        aucune pièce intrusive. On ne réclame ID / origine des
                        fonds QUE si un signal l'exige (approche par les risques).
   • assessArtwork    : vigilance d'une œuvre. Provenance structurée (détection
                        de rupture et de trou 1933-1945), registres vol/spoliation.
   • aggregateTransaction : combine acheteur + vendeur + œuvre, sans rien inventer.

  Aucun composant n'est simulé. Chaque facteur retenu est listé en clair.
*/

import {
  assessJurisdiction,
  JURISDICTION_LABEL,
  type JurisdictionRisk,
} from "./jurisdictions";
import { overlapsWindow, yearBounds, type YearRange } from "./dates";
import type {
  Actor,
  ActorAssessment,
  Artwork,
  ArtworkAssessment,
  ArtworkCategory,
  AuditAnswer,
  BeneficialOwner,
  CollectionItem,
  RiskLevel,
  ScreeningResult,
  SubScore,
  VigilanceTier,
} from "./types";

/* ───────────────────────── Utilitaires de niveau ───────────────────────── */

function levelFromPoints(points: number): RiskLevel {
  if (points >= 6) return "eleve";
  if (points >= 3) return "vigilance";
  return "faible";
}

/** Niveau le plus sévère d'une liste. */
function worstLevel(levels: RiskLevel[]): RiskLevel {
  if (levels.includes("eleve")) return "eleve";
  if (levels.includes("vigilance")) return "vigilance";
  return "faible";
}

/** Une entité intermédiaire de la chaîne UBO sans bénéficiaire déclaré ? */
function hasOpaqueEntity(bens: BeneficialOwner[]): boolean {
  return bens.some(
    (b) =>
      b.kind === "entite" &&
      (b.beneficiaires.length === 0 || hasOpaqueEntity(b.beneficiaires)),
  );
}

/** Nombre total de nœuds dans l'arbre des bénéficiaires (cascade comprise). */
function countBeneficiaries(bens: BeneficialOwner[]): number {
  return bens.reduce(
    (n, b) => n + 1 + (b.kind === "entite" ? countBeneficiaries(b.beneficiaires) : 0),
    0,
  );
}

/* ───────────────────────── ACTEUR ───────────────────────── */

/**
 * Indices de vigilance FACULTATIFS d'un acteur. Jamais obligatoires :
 * `null` (non renseigné) n'ajoute aucun point — c'est le principe « le moins
 * de questions possible ». Seul un drapeau explicite compte.
 */
export function freshActorIndices(): AuditAnswer[] {
  const q: Omit<AuditAnswer, "reponse">[] = [
    {
      id: "structure_ecran",
      question:
        "La partie agit-elle via une structure (société-écran, mandat) dont le bénéficiaire est opaque ?",
      categorie: "Transparence",
      flagValue: true,
      poids: 3,
    },
    {
      id: "reticence_info",
      question:
        "Le client manifeste-t-il une réticence inhabituelle à fournir des informations ?",
      categorie: "Transparence",
      flagValue: true,
      poids: 2,
    },
  ];
  return q.map((x) => ({ ...x, reponse: null }));
}

interface ActorContext {
  seuilVigilanceEur: number;
  montantEur?: number | null;
}

/**
 * Synthèse de vigilance d'un acteur, par approche des risques.
 * @param screening résultat sur l'acteur lui-même
 * @param beneficiaires résultats sur les bénéficiaires effectifs (entités)
 */
export function assessActor(
  actor: Actor,
  screening: ScreeningResult,
  beneficiaires: ScreeningResult[],
  ctx: ActorContext,
): ActorAssessment {
  // ── Signaux automatiques (sourcés, pas demandés) ──────────────────────
  const allScreenings = [screening, ...beneficiaires];
  const hasSanction = allScreenings.some((r) => r.status === "sanction");
  const hasPpe = allScreenings.some((r) => r.status === "ppe");
  const hasMedia = allScreenings.some((r) => r.status === "media");
  const hasError = allScreenings.some((r) => r.status === "error");
  const isDemo = screening.status === "demo";

  const jurPays = assessJurisdiction(actor.pays);
  const jurNat =
    actor.kind === "personne" ? assessJurisdiction(actor.nationalite) : "none";
  const jur: JurisdictionRisk =
    jurPays === "high" || jurNat === "high"
      ? "high"
      : jurPays === "monitored" || jurNat === "monitored"
        ? "monitored"
        : "none";

  const montant = ctx.montantEur ?? null;
  const montantDepasse =
    actor.transactionSuperieureSeuil ||
    (montant != null && montant >= ctx.seuilVigilanceEur);

  const actorSansUbo = actor.kind === "entite" && actor.beneficiaires.length === 0;
  const cascadeOpaque = hasOpaqueEntity(actor.beneficiaires);
  const opaciteEntite = actorSansUbo || cascadeOpaque;
  const indiceTransparence = actor.indices.some(
    (a) => a.reponse !== null && a.reponse === a.flagValue,
  );
  const opacite = opaciteEntite || indiceTransparence;

  // ── Sous-scores explicables ───────────────────────────────────────────
  const sousScores: SubScore[] = [];

  // Sanctions
  {
    const facteurs: string[] = [];
    let points = 0;
    if (hasSanction) {
      facteurs.push(
        "Correspondance liste de sanctions — blocage à confirmer, décision humaine impérative.",
      );
      points += 100;
    } else if (isDemo) {
      facteurs.push(
        "Screening en mode démonstration — NON probant. Configurez une clé API.",
      );
    } else if (hasError) {
      facteurs.push("Screening non abouti — à relancer.");
      points += 2;
    } else {
      facteurs.push("Aucune correspondance de sanction sur les listes interrogées.");
    }
    sousScores.push({
      categorie: "Sanctions",
      points,
      niveau: hasSanction ? "eleve" : levelFromPoints(points),
      facteurs,
    });
  }

  // PPE / Médias
  {
    const facteurs: string[] = [];
    let points = 0;
    if (hasPpe) {
      facteurs.push(
        "Personne politiquement exposée (PPE) — vigilance renforcée requise par la loi.",
      );
      points += 4;
    }
    if (hasMedia) {
      facteurs.push("Présence en médias négatifs (adverse media) — à examiner.");
      points += 2;
    }
    if (!hasPpe && !hasMedia && !isDemo)
      facteurs.push("Aucun signalement PPE ni média négatif.");
    sousScores.push({
      categorie: "PPE / Médias",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  // Juridiction (dérivée, pas demandée)
  {
    const facteurs: string[] = [];
    let points = 0;
    if (jur === "high") {
      facteurs.push(
        `Juridiction à très haut risque (${JURISDICTION_LABEL.high}) — vigilance renforcée.`,
      );
      points += 5;
    } else if (jur === "monitored") {
      facteurs.push(
        `Juridiction sous surveillance renforcée GAFI (${JURISDICTION_LABEL.monitored}).`,
      );
      points += 3;
    } else {
      facteurs.push("Juridiction hors listes GAFI connues.");
    }
    sousScores.push({
      categorie: "Juridiction",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  // Transparence (UBO / structure, chaîne en cascade comprise)
  {
    const facteurs: string[] = [];
    let points = 0;
    if (actorSansUbo) {
      facteurs.push(
        "Entité sans bénéficiaire effectif déclaré — transparence à établir.",
      );
      points += 3;
    }
    if (cascadeOpaque) {
      facteurs.push(
        "Chaîne UBO incomplète : une entité intermédiaire n'a pas de bénéficiaire déclaré.",
      );
      points += 3;
    }
    if (indiceTransparence) {
      facteurs.push("Indice de structure opaque signalé par le galeriste.");
      points += 3;
    }
    if (actor.kind === "entite" && actor.beneficiaires.length > 0)
      facteurs.push(
        `Chaîne de ${countBeneficiaries(actor.beneficiaires)} bénéficiaire(s) effectif(s) déclaré(s).`,
      );
    if (!opacite && actor.kind === "personne")
      facteurs.push("Personne physique — pas de structure interposée.");
    sousScores.push({
      categorie: "Transparence",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  // Identité (complétude des données d'identification)
  {
    const facteurs: string[] = [];
    let points = 0;
    const manquants: string[] = [];
    if (!actor.nom.trim()) manquants.push("nom");
    if (actor.kind === "personne") {
      if (!actor.prenoms.trim()) manquants.push("prénom(s)");
      if (!actor.dateNaissance) manquants.push("date de naissance");
      if (!actor.nationalite.trim()) manquants.push("nationalité");
    } else {
      if (!actor.immatriculation.trim()) manquants.push("immatriculation");
    }
    if (manquants.length) {
      facteurs.push(`Données d'identification incomplètes : ${manquants.join(", ")}.`);
      points += 1;
    } else {
      facteurs.push("Données d'identification de base renseignées.");
    }
    if (screening.desambiguise)
      facteurs.push(
        "Screening désambiguïsé (date de naissance / nationalité) — faux positifs réduits.",
      );
    sousScores.push({
      categorie: "Identité",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  // ── Niveau de vigilance (tier) — approche par les risques ─────────────
  let tier: VigilanceTier;
  if (
    hasSanction ||
    hasPpe ||
    jur === "high" ||
    (jur === "monitored" && montantDepasse) ||
    (montantDepasse && opacite)
  ) {
    tier = "renforcee";
  } else if (montantDepasse || jur === "monitored" || hasMedia || opacite || hasError) {
    tier = "standard";
  } else {
    tier = "simplifiee";
  }

  // ── Pièces à collecter — le minimum dû, justifié ──────────────────────
  const piecesACollecter: CollectionItem[] = [];
  const motifs: string[] = [];
  if (hasSanction) motifs.push("correspondance de sanction");
  if (hasPpe) motifs.push("personne politiquement exposée");
  if (jur === "high") motifs.push("juridiction à très haut risque");
  else if (jur === "monitored") motifs.push("juridiction sous surveillance GAFI");
  if (montantDepasse)
    motifs.push(
      `montant ≥ seuil (${ctx.seuilVigilanceEur.toLocaleString("fr-FR")} €)`,
    );
  if (opacite) motifs.push("structure / bénéficiaire opaque");
  const motifTxt = motifs.length
    ? motifs.join(", ")
    : "aucun signal de risque particulier";
  const ceRole =
    actor.role === "vendeur" ? "ce vendeur" : actor.role === "acheteur" ? "cet acheteur" : "cet intermédiaire";

  if (tier !== "simplifiee") {
    piecesACollecter.push({
      id: "identite",
      label:
        actor.kind === "personne"
          ? "Pièce d'identité officielle en cours de validité"
          : "Extrait d'immatriculation (Kbis ou équivalent) récent",
      motif: `Vérification d'identité — ${motifTxt}.`,
    });
  }
  if (tier === "renforcee") {
    piecesACollecter.push({
      id: "origine_fonds",
      label: "Justificatif d'origine des fonds / du patrimoine",
      motif: `Vigilance renforcée — ${motifTxt}.`,
    });
    if (actor.kind === "entite") {
      piecesACollecter.push({
        id: "ubo",
        label: "Documentation de la chaîne de bénéficiaires effectifs (UBO)",
        motif: `Transparence de la structure — ${motifTxt}.`,
      });
    }
  }

  // ── Niveau global + liste à plat ──────────────────────────────────────
  const totalPoints = sousScores.reduce((s, x) => s + x.points, 0);
  const niveau: RiskLevel = hasSanction ? "eleve" : levelFromPoints(totalPoints);

  const facteurs: string[] = [];
  facteurs.push(
    `Niveau de vigilance retenu : ${TIER_META[tier].label.toLowerCase()} (${motifTxt}).`,
  );
  for (const s of sousScores)
    for (const f of s.facteurs)
      if (!f.startsWith("Aucun") && !f.startsWith("Données d'identification de base"))
        facteurs.push(`${s.categorie} — ${f}`);
  if (tier === "simplifiee")
    facteurs.push(
      `Aucune pièce intrusive requise à ce stade pour ${ceRole} (vigilance simplifiée).`,
    );

  return {
    niveau,
    tier,
    sousScores,
    facteurs,
    piecesACollecter,
    revueHumaineRequise: true,
  };
}

/* ───────────────────────── ŒUVRE ───────────────────────── */

/** Checklist authenticité / titre d'une œuvre, ADAPTÉE à la catégorie. */
export function freshArtworkAudit(
  categorie: ArtworkCategory = "peinture_dessin",
): AuditAnswer[] {
  const base: Omit<AuditAnswer, "reponse">[] = [
    {
      id: "catalogue_raisonne",
      question:
        "L'œuvre figure-t-elle dans le catalogue raisonné de l'artiste (ou un référentiel reconnu) ?",
      categorie: "Authenticité",
      flagValue: false,
      poids: 2,
    },
    {
      id: "certificat_authenticite",
      question:
        "Un certificat d'authenticité émis par une autorité compétente est-il fourni ?",
      categorie: "Authenticité",
      flagValue: false,
      poids: 1,
    },
    {
      id: "facture_origine",
      question: "Disposez-vous d'une facture ou d'un titre de propriété d'origine ?",
      categorie: "Titre",
      flagValue: false,
      poids: 2,
    },
    {
      id: "litige_revendication",
      question:
        "L'œuvre fait-elle l'objet d'un litige, d'un gage ou d'une revendication connus ?",
      categorie: "Titre",
      flagValue: true,
      poids: 3,
    },
  ];

  const extra: Omit<AuditAnswer, "reponse">[] = [];
  if (categorie === "antiquite") {
    extra.push(
      {
        id: "provenance_1970",
        question:
          "La provenance est-elle documentée avant 1970 (convention UNESCO sur les biens culturels) ?",
        categorie: "Provenance",
        flagValue: false,
        poids: 3,
      },
      {
        id: "export_autorisation",
        question:
          "Les licences d'export / import du bien culturel sont-elles disponibles ?",
        categorie: "Provenance",
        flagValue: false,
        poids: 3,
      },
      {
        id: "cites_materiaux",
        question:
          "Si l'objet contient des matériaux protégés (ivoire, écaille…), les justificatifs CITES sont-ils fournis ?",
        categorie: "Titre",
        flagValue: false,
        poids: 2,
      },
    );
  } else if (categorie === "estampe_multiple" || categorie === "sculpture") {
    extra.push({
      id: "edition_legitime",
      question:
        "Le tirage est-il numéroté, justifié et conforme (pas un tirage posthume non déclaré) ?",
      categorie: "Authenticité",
      flagValue: false,
      poids: 2,
    });
  }

  return [...base, ...extra].map((x) => ({ ...x, reponse: null }));
}

/** Indicateurs de risque du marché de l'art (lignes directrices GAFI). */
export function freshArtworkRedFlags(): AuditAnswer[] {
  const source = "Indicateur GAFI — marché de l'art (2023)";
  const q: Omit<AuditAnswer, "reponse">[] = [
    {
      id: "rf_fresh",
      question:
        "L'œuvre apparaît-elle sur le marché sans aucun historique d'exposition ni de vente (« fraîche au marché ») ?",
      categorie: "Indicateurs GAFI",
      flagValue: true,
      poids: 2,
      source,
    },
    {
      id: "rf_reticence",
      question: "Le vendeur est-il réticent à divulguer l'identité du précédent propriétaire ?",
      categorie: "Indicateurs GAFI",
      flagValue: true,
      poids: 3,
      source,
    },
    {
      id: "rf_prix",
      question:
        "Le prix est-il manifestement incohérent avec le marché (très au-dessus ou en-dessous) ?",
      categorie: "Indicateurs GAFI",
      flagValue: true,
      poids: 2,
      source,
    },
    {
      id: "rf_intermediaire",
      question: "L'opération passe-t-elle par une structure opaque ou un intermédiaire anonyme ?",
      categorie: "Indicateurs GAFI",
      flagValue: true,
      poids: 3,
      source,
    },
    {
      id: "rf_resurface",
      question:
        "L'œuvre a-t-elle refait surface après avoir été déclarée perdue ou volée, puis radiée ?",
      categorie: "Indicateurs GAFI",
      flagValue: true,
      poids: 3,
      source,
    },
  ];
  return q.map((x) => ({ ...x, reponse: null }));
}

/** Régénère la checklist selon une catégorie en préservant les réponses par id. */
export function rebuildArtworkAudit(
  categorie: ArtworkCategory,
  previous: AuditAnswer[],
): AuditAnswer[] {
  const prev = new Map(previous.map((a) => [a.id, a.reponse]));
  return freshArtworkAudit(categorie).map((a) => ({
    ...a,
    reponse: prev.get(a.id) ?? null,
  }));
}

/**
 * La chaîne de provenance couvre-t-elle la période 1933-1945 ?
 * Heuristique transparente : on regarde si un maillon documente une détention
 * recouvrant cette fenêtre. Sinon, drapeau spoliation. Les dates floues
 * (« vers 1941 », « milieu du XXe siècle », « années 40 ») sont interprétées
 * par `dates.ts` de façon prudente pour ne pas rater le trou.
 */
function couvrePeriodeSpoliation(artwork: Artwork): {
  pertinent: boolean;
  couvert: boolean;
} {
  // Année de création plausible la plus ancienne (borne basse).
  const anneeCreation = yearBounds(artwork.annee)?.min;
  // Non pertinent si l'œuvre est manifestement créée après 1945.
  const pertinent = !anneeCreation || anneeCreation <= 1945;
  if (!pertinent) return { pertinent: false, couvert: true };
  const couvert = artwork.provenance.some((p) =>
    overlapsWindow(`${p.periode} ${p.proprietaire}`, 1933, 1945),
  );
  return { pertinent: true, couvert };
}

/** Synthèse de vigilance d'une œuvre. */
export function assessArtwork(artwork: Artwork): ArtworkAssessment {
  const sousScores: SubScore[] = [];

  const auditByCat = (cat: string) =>
    artwork.audit.filter((a) => a.categorie === cat);

  // Provenance (enrichie : ruptures, incohérences, qualité de source, 1ʳᵉ apparition)
  {
    const facteurs: string[] = [];
    let points = 0;
    const entries = artwork.provenance.filter((p) => p.proprietaire.trim());
    const n = entries.length;
    if (n === 0) {
      facteurs.push("Aucune chaîne de provenance renseignée.");
      points += 3;
    } else if (n === 1) {
      facteurs.push("Chaîne de provenance très courte (un seul maillon).");
      points += 2;
    } else {
      facteurs.push(`Chaîne de provenance documentée (${n} maillons).`);
    }

    // Qualité documentaire graduée (source faible ou absente).
    const faibles = entries.filter(
      (p) => p.typeSource === "aucune" || p.typeSource === "mention",
    ).length;
    if (faibles > 0) {
      facteurs.push(`${faibles} maillon(s) à la source faible ou absente.`);
      points += faibles;
    }

    // Bornes temporelles par maillon (dates floues comprises).
    const spans: YearRange[] = entries
      .map((p) => yearBounds(`${p.periode} ${p.proprietaire}`))
      .filter((b): b is YearRange => b !== null)
      .sort((a, b) => a.min - b.min);

    // Rupture temporelle (> 30 ans entre deux maillons consécutifs).
    let maxGap = 0;
    let gapFrom = 0;
    let gapTo = 0;
    for (let i = 1; i < spans.length; i++) {
      const gap = spans[i].min - spans[i - 1].max;
      if (gap > maxGap) {
        maxGap = gap;
        gapFrom = spans[i - 1].max;
        gapTo = spans[i].min;
      }
    }
    if (maxGap > 30) {
      facteurs.push(
        `Rupture de provenance d'environ ${maxGap} ans (~${gapFrom}–${gapTo}) — à expliquer.`,
      );
      points += 2;
    }

    // Incohérence : un maillon antérieur à la création de l'œuvre.
    const creationYear = yearBounds(artwork.annee)?.min;
    if (creationYear && spans.some((s) => s.min < creationYear)) {
      facteurs.push("Incohérence : un maillon est daté avant la création de l'œuvre.");
      points += 3;
    }

    // Première apparition publique.
    if (!artwork.premiereApparition.trim()) {
      facteurs.push(
        "Première apparition publique non documentée (œuvre « fraîche au marché » ?).",
      );
      points += 1;
    }

    // Questions de provenance propres à la catégorie (antiquité : 1970, export…).
    for (const a of auditByCat("Provenance")) {
      if (a.reponse !== null && a.reponse === a.flagValue) {
        facteurs.push(`Point de vigilance : « ${a.question} »`);
        points += a.poids;
      }
    }
    sousScores.push({
      categorie: "Provenance",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  // Spoliation (1933-1945)
  {
    const facteurs: string[] = [];
    let points = 0;
    const spo = artwork.registres.filter((r) => r.kind === "spoliation");
    const corr = spo.filter((r) => r.resultat === "correspondance");
    const nonVerif = spo.filter((r) => r.resultat === "non_verifie");
    if (corr.length) {
      facteurs.push(
        `Correspondance dans un registre de spoliation : ${corr.map((r) => r.registre).join(", ")} — blocage à confirmer.`,
      );
      points += 100;
    }
    const era = couvrePeriodeSpoliation(artwork);
    if (era.pertinent && !era.couvert) {
      facteurs.push(
        "Trou de provenance sur la période 1933-1945 (œuvre antérieure à 1945) — risque de spoliation à lever.",
      );
      points += 4;
    }
    if (nonVerif.length) {
      facteurs.push(
        `Registres de spoliation non encore vérifiés : ${nonVerif.map((r) => r.registre).join(", ")}.`,
      );
      points += nonVerif.length;
    }
    if (!corr.length && !nonVerif.length && spo.length)
      facteurs.push("Aucune correspondance constatée dans les registres de spoliation.");
    sousScores.push({
      categorie: "Spoliation",
      points,
      niveau: corr.length ? "eleve" : levelFromPoints(points),
      facteurs,
    });
  }

  // Vol
  {
    const facteurs: string[] = [];
    let points = 0;
    const vol = artwork.registres.filter((r) => r.kind === "vol");
    const corr = vol.filter((r) => r.resultat === "correspondance");
    const nonVerif = vol.filter((r) => r.resultat === "non_verifie");
    if (corr.length) {
      facteurs.push(
        `Correspondance dans un registre d'œuvres volées : ${corr.map((r) => r.registre).join(", ")} — blocage à confirmer.`,
      );
      points += 100;
    }
    if (nonVerif.length) {
      facteurs.push(
        `Registres d'œuvres volées non encore vérifiés : ${nonVerif.map((r) => r.registre).join(", ")}.`,
      );
      points += nonVerif.length;
    }
    if (!corr.length && !nonVerif.length && vol.length)
      facteurs.push("Aucune correspondance constatée dans les registres d'œuvres volées.");
    sousScores.push({
      categorie: "Vol",
      points,
      niveau: corr.length ? "eleve" : levelFromPoints(points),
      facteurs,
    });
  }

  // Authenticité
  pushAuditSubScore(sousScores, "Authenticité", auditByCat("Authenticité"));
  // Titre
  pushAuditSubScore(sousScores, "Titre", auditByCat("Titre"));

  // Indicateurs GAFI (red flags) — null ignoré, seul un drapeau coché compte.
  {
    const facteurs: string[] = [];
    let points = 0;
    for (const a of artwork.redFlags) {
      if (a.reponse !== null && a.reponse === a.flagValue) {
        facteurs.push(`Indicateur signalé : « ${a.question} »`);
        points += a.poids;
      }
    }
    if (facteurs.length === 0) facteurs.push("Aucun indicateur de risque signalé.");
    sousScores.push({
      categorie: "Indicateurs GAFI",
      points,
      niveau: levelFromPoints(points),
      facteurs,
    });
  }

  const hasBlocage = sousScores.some(
    (s) =>
      (s.categorie === "Vol" || s.categorie === "Spoliation") &&
      s.niveau === "eleve" &&
      s.points >= 100,
  );
  const totalPoints = sousScores.reduce((s, x) => s + x.points, 0);
  const niveau: RiskLevel = hasBlocage ? "eleve" : levelFromPoints(totalPoints);

  const facteurs: string[] = [];
  for (const s of sousScores)
    for (const f of s.facteurs)
      if (!f.startsWith("Aucun") && !f.startsWith("Chaîne de provenance documentée"))
        facteurs.push(`${s.categorie} — ${f}`);
  if (facteurs.length === 0)
    facteurs.push("Aucun point de vigilance déclaré sur les éléments fournis.");

  return { niveau, sousScores, facteurs, revueHumaineRequise: true };
}

function pushAuditSubScore(
  out: SubScore[],
  categorie: string,
  answers: AuditAnswer[],
): void {
  const facteurs: string[] = [];
  let points = 0;
  for (const a of answers) {
    if (a.reponse === null) {
      facteurs.push(`Non renseigné : « ${a.question} »`);
      points += 1;
    } else if (a.reponse === a.flagValue) {
      facteurs.push(`Point de vigilance : « ${a.question} »`);
      points += a.poids;
    }
  }
  if (facteurs.length === 0) facteurs.push("Éléments favorables sur ce volet.");
  out.push({ categorie, points, niveau: levelFromPoints(points), facteurs });
}

/* ───────────────────────── TRANSACTION ───────────────────────── */

/** Checklist comportementale de la transaction (espèces, urgence…). */
export function freshComportement(): AuditAnswer[] {
  const q: Omit<AuditAnswer, "reponse">[] = [
    {
      id: "paiement_especes",
      question:
        "Le règlement implique-t-il des espèces ou des crypto-actifs au-delà des seuils réglementaires ?",
      categorie: "Comportement",
      flagValue: true,
      poids: 3,
    },
    {
      id: "paiement_tiers",
      question:
        "Le paiement provient-il d'un tiers non partie à la transaction ?",
      categorie: "Comportement",
      flagValue: true,
      poids: 3,
    },
    {
      id: "urgence_incoherence",
      question:
        "La transaction présente-t-elle une urgence, une discrétion ou un prix incohérent inhabituels ?",
      categorie: "Comportement",
      flagValue: true,
      poids: 2,
    },
  ];
  return q.map((x) => ({ ...x, reponse: null }));
}

/** Agrège les volets d'une transaction en une synthèse globale. */
export function aggregateTransaction(input: {
  montantEur: number | null;
  acheteur: ActorAssessment;
  vendeur: ActorAssessment | null;
  oeuvre: ArtworkAssessment;
  comportement: AuditAnswer[];
}): { niveau: RiskLevel; facteurs: string[] } {
  const facteurs: string[] = [];
  let points = 0;

  facteurs.push(`Acheteur — ${RISK_META[input.acheteur.niveau].label.toLowerCase()}.`);
  if (input.vendeur)
    facteurs.push(`Vendeur — ${RISK_META[input.vendeur.niveau].label.toLowerCase()}.`);
  facteurs.push(`Œuvre — ${RISK_META[input.oeuvre.niveau].label.toLowerCase()}.`);

  for (const a of input.comportement) {
    if (a.reponse !== null && a.reponse === a.flagValue) {
      facteurs.push(`Comportement — point de vigilance : « ${a.question} »`);
      points += a.poids;
    }
  }

  const levels = [input.acheteur.niveau, input.oeuvre.niveau];
  if (input.vendeur) levels.push(input.vendeur.niveau);
  let niveau = worstLevel(levels);
  // Le comportement peut faire monter, jamais descendre.
  if (points >= 6) niveau = "eleve";
  else if (points >= 3 && niveau === "faible") niveau = "vigilance";

  return { niveau, facteurs };
}

/* ───────────────────────── Métadonnées d'affichage ───────────────────────── */

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; bg: string; macaron: string }
> = {
  faible: {
    label: "Risque faible",
    color: "var(--color-risk-low)",
    bg: "var(--color-risk-low-bg)",
    macaron: "Vert",
  },
  vigilance: {
    label: "Vigilance",
    color: "var(--color-risk-mid)",
    bg: "var(--color-risk-mid-bg)",
    macaron: "Orange",
  },
  eleve: {
    label: "Risque élevé",
    color: "var(--color-risk-high)",
    bg: "var(--color-risk-high-bg)",
    macaron: "Rouge",
  },
};

export const TIER_META: Record<
  VigilanceTier,
  { label: string; color: string; bg: string; desc: string }
> = {
  simplifiee: {
    label: "Vigilance simplifiée",
    color: "var(--color-risk-low)",
    bg: "var(--color-risk-low-bg)",
    desc: "Aucune pièce intrusive requise à ce stade.",
  },
  standard: {
    label: "Vigilance standard",
    color: "var(--color-risk-mid)",
    bg: "var(--color-risk-mid-bg)",
    desc: "Identité de base à recueillir.",
  },
  renforcee: {
    label: "Vigilance renforcée",
    color: "var(--color-risk-high)",
    bg: "var(--color-risk-high-bg)",
    desc: "Identité + origine des fonds à recueillir.",
  },
};
