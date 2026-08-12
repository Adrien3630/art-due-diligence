/*
  VERROU DU BARÈME — fidélité code ↔ document.

  Ce fichier fige chaque valeur chiffrée exposée dans BAREME_A_VALIDER.md
  (points, poids, seuils, bornes) telle qu'implémentée par le moteur. But :
  garantir que le document envoyé au juriste décrit EXACTEMENT le code, et
  qu'aucune modification ultérieure du barème ne passe inaperçue.

  Règle : si un test ici échoue, ce n'est pas un bug — c'est que le barème a
  changé. Il faut alors mettre à jour BAREME_A_VALIDER.md (et refaire valider)
  EN MÊME TEMPS que le code. Les références « B0 »… renvoient aux sections du doc.
*/

import { describe, it, expect } from "vitest";
import {
  assessActor,
  assessArtwork,
  aggregateTransaction,
  freshActorIndices,
  freshArtworkAudit,
  freshArtworkRedFlags,
  freshComportement,
} from "../scoring";
import { assessPriceCoherence } from "../market";
import {
  assessJurisdiction,
  GAFI_SNAPSHOT_DATE,
} from "../jurisdictions";
import { DEFAULT_SETTINGS } from "../vault";
import { emptyActor, emptyArtwork } from "../factories";
import type { Actor, Artwork, ScreeningResult } from "../types";

/* ───────────────── Helpers ───────────────── */

const ctx = { seuilVigilanceEur: 10000, montantEur: null as number | null };

function screening(status: ScreeningResult["status"]): ScreeningResult {
  return {
    sujet: "Sujet",
    status,
    matches: [],
    listesInterrogees: ["OFAC SDN"],
    fournisseur: "Test",
    horodatage: "2026-01-01T00:00:00.000Z",
    desambiguise: false,
  };
}
const clear = () => screening("clear");

/** Personne à l'identité complète → tous les sous-scores « neutres » à 0. */
function fullPerson(): Actor {
  const a = emptyActor("acheteur");
  a.nom = "Martin";
  a.prenoms = "Sophie";
  a.dateNaissance = "1980-01-01";
  a.nationalite = "Française";
  a.pays = "France";
  return a;
}

/** Points d'un sous-score d'acteur par catégorie. */
function actorPoints(a: Actor, s: ScreeningResult, categorie: string): number {
  const r = assessActor(a, s, [], ctx);
  return r.sousScores.find((x) => x.categorie === categorie)?.points ?? NaN;
}

/** Points d'un sous-score d'œuvre par catégorie. */
function artworkPoints(a: Artwork, categorie: string): number {
  const r = assessArtwork(a);
  return r.sousScores.find((x) => x.categorie === categorie)?.points ?? NaN;
}

/* ───────────────── B0 — points → niveau ───────────────── */

describe("B0 — conversion points → niveau (frontières 3 et 6)", () => {
  it("total < 3 → faible", () => {
    // Identité incomplète seule = +1.
    const a = fullPerson();
    a.dateNaissance = "";
    expect(assessActor(a, clear(), [], ctx).niveau).toBe("faible");
  });
  it("total ≥ 3 et < 6 → vigilance", () => {
    // Juridiction liste grise seule = +3.
    const a = fullPerson();
    a.pays = "Monaco";
    expect(assessActor(a, clear(), [], ctx).niveau).toBe("vigilance");
  });
  it("total ≥ 6 → élevé", () => {
    // Liste noire (+5) + identité incomplète (+1) = 6.
    const a = fullPerson();
    a.pays = "Iran";
    a.nationalite = "";
    expect(assessActor(a, clear(), [], ctx).niveau).toBe("eleve");
  });
});

/* ───────────────── B1 — sous-scores ACTEUR ───────────────── */

describe("B1 — points des facteurs acteur", () => {
  it("correspondance sanction = +100 (force élevé)", () => {
    expect(actorPoints(fullPerson(), screening("sanction"), "Sanctions")).toBe(100);
    expect(assessActor(fullPerson(), screening("sanction"), [], ctx).niveau).toBe("eleve");
  });
  it("PPE = +4", () => {
    expect(actorPoints(fullPerson(), screening("ppe"), "PPE / Médias")).toBe(4);
  });
  it("média négatif = +2", () => {
    expect(actorPoints(fullPerson(), screening("media"), "PPE / Médias")).toBe(2);
  });
  it("screening en erreur = +2", () => {
    expect(actorPoints(fullPerson(), screening("error"), "Sanctions")).toBe(2);
  });
  it("juridiction liste noire = +5", () => {
    const a = fullPerson();
    a.pays = "Iran";
    expect(actorPoints(a, clear(), "Juridiction")).toBe(5);
  });
  it("juridiction liste grise = +3", () => {
    const a = fullPerson();
    a.pays = "Monaco";
    expect(actorPoints(a, clear(), "Juridiction")).toBe(3);
  });
  it("entité sans bénéficiaire effectif = +3", () => {
    const e = emptyActor("acheteur");
    e.kind = "entite";
    e.nom = "Société X";
    e.immatriculation = "RCS 123";
    e.beneficiaires = [];
    expect(actorPoints(e, clear(), "Transparence")).toBe(3);
  });
  it("indice d'opacité signalé = +3", () => {
    const a = fullPerson();
    a.indices = freshActorIndices().map((q) =>
      q.id === "structure_ecran" ? { ...q, reponse: q.flagValue } : q,
    );
    expect(actorPoints(a, clear(), "Transparence")).toBe(3);
  });
  it("données d'identification incomplètes = +1", () => {
    const a = fullPerson();
    a.dateNaissance = "";
    expect(actorPoints(a, clear(), "Identité")).toBe(1);
  });
});

/* ───────────────── B2 — logique de tier ───────────────── */

describe("B2 — déclenchement du niveau de vigilance (tier)", () => {
  it("PPE seule → renforcée (indépendamment du montant)", () => {
    expect(assessActor(fullPerson(), screening("ppe"), [], ctx).tier).toBe("renforcee");
  });
  it("liste grise SANS dépassement de seuil → standard (pas renforcée)", () => {
    const a = fullPerson();
    a.pays = "Monaco";
    expect(assessActor(a, clear(), [], { ...ctx, montantEur: null }).tier).toBe("standard");
  });
  it("liste grise AVEC dépassement de seuil → renforcée", () => {
    const a = fullPerson();
    a.pays = "Monaco";
    expect(assessActor(a, clear(), [], { ...ctx, montantEur: 20000 }).tier).toBe("renforcee");
  });
  it("aucun signal → simplifiée (aucune pièce)", () => {
    const r = assessActor(fullPerson(), clear(), [], ctx);
    expect(r.tier).toBe("simplifiee");
    expect(r.piecesACollecter).toHaveLength(0);
  });
});

/* ───────────────── B4 — sous-scores ŒUVRE ───────────────── */

describe("B4 — points des facteurs œuvre", () => {
  it("aucune provenance = +3", () => {
    const a = emptyArtwork();
    a.premiereApparition = "documentée"; // neutralise le +1 « fraîche au marché »
    a.provenance = [];
    expect(artworkPoints(a, "Provenance")).toBe(3);
  });
  it("provenance d'un seul maillon = +2", () => {
    const a = emptyArtwork();
    a.premiereApparition = "documentée";
    a.provenance = [
      { id: "1", periode: "1970", proprietaire: "Galerie A", lieu: "Paris", source: "Facture", typeSource: "facture" },
    ];
    expect(artworkPoints(a, "Provenance")).toBe(2);
  });
  it("première apparition non documentée = +1", () => {
    const a = emptyArtwork();
    a.provenance = [
      { id: "1", periode: "1970", proprietaire: "A", lieu: "Paris", source: "Facture", typeSource: "facture" },
      { id: "2", periode: "1990", proprietaire: "B", lieu: "Lyon", source: "Archive", typeSource: "archive" },
    ];
    a.premiereApparition = "";
    expect(artworkPoints(a, "Provenance")).toBe(1);
  });
  it("correspondance registre spoliation = +100 (blocage, élevé)", () => {
    const a = emptyArtwork();
    a.registres = a.registres.map((r) =>
      r.kind === "spoliation" ? { ...r, resultat: "correspondance" as const } : { ...r, resultat: "aucune" as const },
    );
    const r = assessArtwork(a);
    const spo = r.sousScores.find((x) => x.categorie === "Spoliation")!;
    expect(spo.points).toBeGreaterThanOrEqual(100);
    expect(spo.niveau).toBe("eleve");
    expect(r.niveau).toBe("eleve");
  });
  it("correspondance registre vol = +100 (blocage, élevé)", () => {
    const a = emptyArtwork();
    a.registres = a.registres.map((r) =>
      r.kind === "vol" ? { ...r, resultat: "correspondance" as const } : { ...r, resultat: "aucune" as const },
    );
    const vol = assessArtwork(a).sousScores.find((x) => x.categorie === "Vol")!;
    expect(vol.points).toBeGreaterThanOrEqual(100);
    expect(vol.niveau).toBe("eleve");
  });
  it("trou de provenance 1933-1945 (œuvre ≤ 1945) = +4", () => {
    const a = emptyArtwork();
    a.annee = "1940";
    a.premiereApparition = "documentée";
    // Un maillon hors fenêtre 1933-1945 → trou non couvert.
    a.provenance = [
      { id: "1", periode: "1970-1990", proprietaire: "Galerie A", lieu: "Paris", source: "Facture", typeSource: "facture" },
    ];
    a.registres = a.registres.map((r) => ({ ...r, resultat: "aucune" as const }));
    // Provenance = un seul maillon (+2) + trou 1933-45 (+4) = 6.
    expect(artworkPoints(a, "Provenance") + artworkPoints(a, "Spoliation")).toBe(2 + 4);
  });
});

/* ── B4bis — poids des questions authenticité / titre (checklist) ── */

describe("B4 — poids des questions d'authenticité / titre", () => {
  const poids = (id: string, cat: Parameters<typeof freshArtworkAudit>[0] = "peinture_dessin") =>
    freshArtworkAudit(cat).find((q) => q.id === id)?.poids;

  it("peinture/dessin : catalogue 2, certificat 1, facture 2, litige 3", () => {
    expect(poids("catalogue_raisonne")).toBe(2);
    expect(poids("certificat_authenticite")).toBe(1);
    expect(poids("facture_origine")).toBe(2);
    expect(poids("litige_revendication")).toBe(3);
  });
  it("antiquité : provenance<1970 = 3, export = 3, CITES = 2", () => {
    expect(poids("provenance_1970", "antiquite")).toBe(3);
    expect(poids("export_autorisation", "antiquite")).toBe(3);
    expect(poids("cites_materiaux", "antiquite")).toBe(2);
  });
  it("estampe/sculpture : édition légitime = 2", () => {
    expect(poids("edition_legitime", "estampe_multiple")).toBe(2);
    expect(poids("edition_legitime", "sculpture")).toBe(2);
  });
});

/* ───────────────── B5 — indicateurs GAFI (poids) ───────────────── */

describe("B5 — poids des indicateurs GAFI marché de l'art", () => {
  const poids = (id: string) => freshArtworkRedFlags().find((q) => q.id === id)?.poids;
  it("fraîche au marché 2, réticence 3, prix 2, intermédiaire 3, réapparition 3", () => {
    expect(poids("rf_fresh")).toBe(2);
    expect(poids("rf_reticence")).toBe(3);
    expect(poids("rf_prix")).toBe(2);
    expect(poids("rf_intermediaire")).toBe(3);
    expect(poids("rf_resurface")).toBe(3);
  });
});

/* ───────────────── B6 — comportement transaction ───────────────── */

describe("B6 — poids du comportement + règle d'agrégation", () => {
  const poids = (id: string) => freshComportement().find((q) => q.id === id)?.poids;
  it("espèces/crypto 3, tiers payeur 3, urgence/incohérence 2", () => {
    expect(poids("paiement_especes")).toBe(3);
    expect(poids("paiement_tiers")).toBe(3);
    expect(poids("urgence_incoherence")).toBe(2);
  });

  const faible = assessActor(fullPerson(), clear(), [], ctx); // niveau faible
  const oeuvreFaible = assessArtwork(
    (() => {
      const a = emptyArtwork();
      a.premiereApparition = "documentée";
      a.provenance = [
        { id: "1", periode: "1970-1990", proprietaire: "A", lieu: "P", source: "Facture", typeSource: "facture" },
        { id: "2", periode: "1990-2020", proprietaire: "B", lieu: "L", source: "Archive", typeSource: "archive" },
      ];
      a.registres = a.registres.map((r) => ({ ...r, resultat: "aucune" as const }));
      a.audit = a.audit.map((q) => ({ ...q, reponse: q.flagValue ? false : true }));
      return a;
    })(),
  );

  const flags = (ids: string[]) =>
    freshComportement().map((q) => (ids.includes(q.id) ? { ...q, reponse: q.flagValue } : q));

  it("comportement ≥ 6 → élevé, même si tous les volets sont faibles", () => {
    const r = aggregateTransaction({
      montantEur: null,
      acheteur: faible,
      vendeur: null,
      oeuvre: oeuvreFaible,
      comportement: flags(["paiement_especes", "paiement_tiers"]), // 3 + 3 = 6
    });
    expect(r.niveau).toBe("eleve");
  });
  it("comportement ≥ 3 → au moins vigilance (jamais de baisse)", () => {
    const r = aggregateTransaction({
      montantEur: null,
      acheteur: faible,
      vendeur: null,
      oeuvre: oeuvreFaible,
      comportement: flags(["paiement_especes"]), // 3
    });
    expect(r.niveau).toBe("vigilance");
  });
});

/* ───────────────── B7 — indices acteur (poids) ───────────────── */

describe("B7 — poids des indices acteur", () => {
  const poids = (id: string) => freshActorIndices().find((q) => q.id === id)?.poids;
  it("structure-écran 3, réticence 2, mandat opaque 3, proche PPE 3", () => {
    expect(poids("structure_ecran")).toBe(3);
    expect(poids("reticence_info")).toBe(2);
    expect(poids("agit_tiers_opaque")).toBe(3);
    expect(poids("proche_ppe")).toBe(3);
  });
  it("un indice signalé = +3 sur Transparence (drapeau global, inchangé)", () => {
    const a = fullPerson();
    a.indices = freshActorIndices().map((q) =>
      q.id === "proche_ppe" ? { ...q, reponse: q.flagValue } : q,
    );
    expect(actorPoints(a, clear(), "Transparence")).toBe(3);
  });
});

/* ───────────────── B8 / A2 — seuils par défaut ───────────────── */

describe("A2 / B8 — seuils paramétrables par défaut", () => {
  it("seuil de vigilance = 10 000 €", () => {
    expect(DEFAULT_SETTINGS.seuilVigilanceEur).toBe(10000);
  });
  it("intervalle de revue = 12 mois", () => {
    expect(DEFAULT_SETTINGS.revueIntervalleMois).toBe(12);
  });
});

/* ───────────────── A4 — snapshot GAFI ───────────────── */

describe("A4 — référentiel de juridictions (snapshot GAFI)", () => {
  it("la date du snapshot correspond à celle du document (juin 2026)", () => {
    expect(GAFI_SNAPSHOT_DATE).toBe("juin 2026");
  });
  it("mapping du snapshot : Iran → noire, Monaco → grise, France → hors liste", () => {
    expect(assessJurisdiction("Iran")).toBe("high");
    expect(assessJurisdiction("Corée du Nord")).toBe("high");
    expect(assessJurisdiction("Monaco")).toBe("monitored");
    expect(assessJurisdiction("France")).toBe("none");
  });
});

/* ───────────────── B5bis — bornes de cohérence de prix ───────────────── */

describe("B5 — bornes de cohérence de prix (assessPriceCoherence)", () => {
  const result = {
    status: "ok" as const,
    fourchetteEur: { min: 10000, max: 20000, mediane: 15000 },
  };
  it("> 1,5 × max → élevé", () => {
    expect(assessPriceCoherence(20000 * 1.5 + 1, result).verdict).toBe("eleve");
    expect(assessPriceCoherence(20000 * 1.5, result).verdict).not.toBe("eleve");
  });
  it("< 0,5 × min → bas", () => {
    expect(assessPriceCoherence(10000 * 0.5 - 1, result).verdict).toBe("bas");
    expect(assessPriceCoherence(10000 * 0.5, result).verdict).not.toBe("bas");
  });
});
