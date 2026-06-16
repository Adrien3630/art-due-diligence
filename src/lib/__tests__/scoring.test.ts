import { describe, it, expect } from "vitest";
import {
  assessActor,
  assessArtwork,
  aggregateTransaction,
  freshActorIndices,
  freshArtworkAudit,
  freshComportement,
  RISK_META,
  TIER_META,
} from "../scoring";
import { emptyActor, emptyArtwork } from "../factories";
import type { Actor, Artwork, ScreeningResult } from "../types";

/* ───────────────── Helpers ───────────────── */

function clearScreening(sujet = "Sujet Test"): ScreeningResult {
  return {
    sujet,
    status: "clear",
    matches: [],
    listesInterrogees: ["OFAC SDN", "EU Consolidated"],
    fournisseur: "Test",
    horodatage: "2026-01-01T00:00:00.000Z",
    desambiguise: false,
  };
}

function withStatus(status: ScreeningResult["status"]): ScreeningResult {
  return { ...clearScreening(), status };
}

/** Personne dont l'identité est complète (pour neutraliser le sous-score Identité). */
function fullPerson(): Actor {
  const a = emptyActor("acheteur");
  a.nom = "Martin";
  a.prenoms = "Sophie";
  a.dateNaissance = "1980-01-01";
  a.nationalite = "Française";
  a.pays = "France";
  return a;
}

/** Œuvre entièrement documentée et vérifiée (doit ressortir « faible »). */
function cleanArtwork(): Artwork {
  const a = emptyArtwork();
  a.titre = "Composition";
  a.artiste = "Artiste";
  a.annee = "1970";
  a.premiereApparition = "Exposition galerie A, 1972";
  a.provenance = [
    { id: "1", periode: "1970-1990", proprietaire: "Galerie A", lieu: "Paris", source: "Facture", typeSource: "facture" },
    { id: "2", periode: "1990-2020", proprietaire: "Collection B", lieu: "Lyon", source: "Archive", typeSource: "archive" },
  ];
  a.registres = a.registres.map((r) => ({ ...r, resultat: "aucune" as const }));
  // Répondre favorablement à chaque question (jamais la valeur-drapeau).
  a.audit = a.audit.map((q) => ({ ...q, reponse: q.flagValue ? false : true }));
  return a;
}

const ctx = { seuilVigilanceEur: 10000 };

/* ───────────────── Acteur ───────────────── */

describe("assessActor — approche par les risques", () => {
  it("acteur sans signal → vigilance simplifiée, aucune pièce, risque faible", () => {
    const r = assessActor(fullPerson(), clearScreening(), [], { ...ctx, montantEur: null });
    expect(r.tier).toBe("simplifiee");
    expect(r.piecesACollecter).toHaveLength(0);
    expect(r.niveau).toBe("faible");
  });

  it("case « transaction > seuil » cochée → vigilance standard + pièce d'identité", () => {
    const a = fullPerson();
    a.transactionSuperieureSeuil = true;
    const r = assessActor(a, clearScreening(), [], { ...ctx, montantEur: null });
    expect(r.tier).toBe("standard");
    const ids = r.piecesACollecter.map((p) => p.id);
    expect(ids).toContain("identite");
    expect(ids).not.toContain("origine_fonds");
  });

  it("montant numérique ≥ seuil → vigilance standard", () => {
    const r = assessActor(fullPerson(), clearScreening(), [], {
      seuilVigilanceEur: 10000,
      montantEur: 15000,
    });
    expect(r.tier).toBe("standard");
  });

  it("juridiction « liste noire » → renforcée (identité + origine des fonds)", () => {
    const a = fullPerson();
    a.pays = "Iran";
    const r = assessActor(a, clearScreening(), [], { ...ctx, montantEur: null });
    expect(r.tier).toBe("renforcee");
    const ids = r.piecesACollecter.map((p) => p.id);
    expect(ids).toContain("identite");
    expect(ids).toContain("origine_fonds");
  });

  it("correspondance sanction → risque élevé et vigilance renforcée", () => {
    const r = assessActor(fullPerson(), withStatus("sanction"), [], { ...ctx, montantEur: null });
    expect(r.niveau).toBe("eleve");
    expect(r.tier).toBe("renforcee");
  });

  it("PPE → vigilance renforcée", () => {
    const r = assessActor(fullPerson(), withStatus("ppe"), [], { ...ctx, montantEur: null });
    expect(r.tier).toBe("renforcee");
  });

  it("entité sans bénéficiaire effectif → opacité (vigilance standard)", () => {
    const a = emptyActor("acheteur");
    a.kind = "entite";
    a.nom = "ArtHolding";
    a.pays = "France";
    a.immatriculation = "123456789";
    const r = assessActor(a, clearScreening(), [], { ...ctx, montantEur: null });
    expect(r.tier).toBe("standard");
    const transp = r.sousScores.find((s) => s.categorie === "Transparence");
    expect(transp?.niveau).not.toBe("faible");
  });

  it("UBO en cascade : entité intermédiaire sans bénéficiaire → opacité", () => {
    const a = emptyActor("acheteur");
    a.kind = "entite";
    a.nom = "TopCo";
    a.pays = "France";
    a.immatriculation = "1";
    a.beneficiaires = [
      {
        kind: "entite",
        pourcentage: "100",
        nom: "MidCo",
        prenoms: "",
        nationalite: "",
        formeJuridique: "Ltd",
        immatriculation: "2",
        beneficiaires: [], // chaîne incomplète
      },
    ];
    const r = assessActor(a, clearScreening(), [], { ...ctx, montantEur: null });
    const transp = r.sousScores.find((s) => s.categorie === "Transparence");
    expect(transp?.facteurs.some((f) => f.includes("Chaîne UBO incomplète"))).toBe(true);
  });

  it("produit les cinq sous-scores acteur attendus", () => {
    const r = assessActor(fullPerson(), clearScreening(), [], { ...ctx, montantEur: null });
    expect(r.sousScores.map((s) => s.categorie).sort()).toEqual(
      ["Identité", "Juridiction", "PPE / Médias", "Sanctions", "Transparence"].sort(),
    );
  });
});

/* ───────────────── Œuvre ───────────────── */

describe("assessArtwork", () => {
  it("œuvre vide → risque élevé (rien de vérifié) et six sous-scores", () => {
    const r = assessArtwork(emptyArtwork());
    expect(r.niveau).toBe("eleve");
    expect(r.sousScores.map((s) => s.categorie).sort()).toEqual(
      ["Authenticité", "Indicateurs GAFI", "Provenance", "Spoliation", "Titre", "Vol"].sort(),
    );
  });

  it("œuvre complètement documentée → risque faible", () => {
    expect(assessArtwork(cleanArtwork()).niveau).toBe("faible");
  });

  it("œuvre antérieure à 1945 sans maillon couvrant 1933-1945 → drapeau spoliation", () => {
    const art = emptyArtwork();
    art.annee = "1938";
    const spo = assessArtwork(art).sousScores.find((s) => s.categorie === "Spoliation");
    expect(
      spo?.facteurs.some((f) => f.includes("Trou de provenance sur la période 1933-1945")),
    ).toBe(true);
  });

  it("œuvre postérieure à 1945 → pas de drapeau « trou 1933-1945 »", () => {
    const art = emptyArtwork();
    art.annee = "1970";
    const spo = assessArtwork(art).sousScores.find((s) => s.categorie === "Spoliation");
    expect(
      spo?.facteurs.some((f) => f.includes("Trou de provenance sur la période 1933-1945")),
    ).toBe(false);
  });

  it("correspondance dans un registre d'œuvres volées → risque élevé", () => {
    const art = emptyArtwork();
    const interpol = art.registres.find((r) => r.id === "interpol");
    if (interpol) interpol.resultat = "correspondance";
    const r = assessArtwork(art);
    expect(r.niveau).toBe("eleve");
    expect(r.sousScores.find((s) => s.categorie === "Vol")?.niveau).toBe("eleve");
  });

  it("détecte une rupture de provenance > 30 ans", () => {
    const a = emptyArtwork();
    a.annee = "1900";
    a.premiereApparition = "exposé 1905";
    a.provenance = [
      { id: "1", periode: "1900-1910", proprietaire: "A", lieu: "", source: "", typeSource: "facture" },
      { id: "2", periode: "1980-2000", proprietaire: "B", lieu: "", source: "", typeSource: "facture" },
    ];
    const prov = assessArtwork(a).sousScores.find((s) => s.categorie === "Provenance");
    expect(prov?.facteurs.some((f) => f.includes("Rupture de provenance"))).toBe(true);
  });

  it("détecte une incohérence chronologique (maillon avant la création)", () => {
    const a = emptyArtwork();
    a.annee = "1960";
    a.premiereApparition = "x";
    a.provenance = [
      { id: "1", periode: "1940", proprietaire: "A", lieu: "", source: "", typeSource: "facture" },
    ];
    const prov = assessArtwork(a).sousScores.find((s) => s.categorie === "Provenance");
    expect(prov?.facteurs.some((f) => f.includes("avant la création"))).toBe(true);
  });

  it("un indicateur GAFI coché alourdit le sous-score dédié", () => {
    const a = emptyArtwork();
    a.redFlags = a.redFlags.map((q) =>
      q.id === "rf_reticence" ? { ...q, reponse: true } : q,
    );
    const gafi = assessArtwork(a).sousScores.find((s) => s.categorie === "Indicateurs GAFI");
    expect(gafi?.facteurs.some((f) => f.includes("Indicateur signalé"))).toBe(true);
  });
});

describe("freshArtworkAudit par catégorie", () => {
  it("antiquité ajoute les questions CITES / 1970 / export", () => {
    const ids = freshArtworkAudit("antiquite").map((q) => q.id);
    expect(ids).toContain("provenance_1970");
    expect(ids).toContain("export_autorisation");
    expect(ids).toContain("cites_materiaux");
  });

  it("peinture n'ajoute pas les questions d'antiquité", () => {
    expect(freshArtworkAudit("peinture_dessin").map((q) => q.id)).not.toContain(
      "cites_materiaux",
    );
  });

  it("estampe ajoute la question d'édition", () => {
    expect(freshArtworkAudit("estampe_multiple").map((q) => q.id)).toContain(
      "edition_legitime",
    );
  });
});

/* ───────────────── Transaction ───────────────── */

describe("aggregateTransaction", () => {
  it("niveau = pire des volets", () => {
    const acheteur = assessActor(fullPerson(), clearScreening(), [], { ...ctx, montantEur: null });
    const oeuvre = assessArtwork(emptyArtwork()); // élevé
    const agg = aggregateTransaction({
      montantEur: null,
      acheteur,
      vendeur: null,
      oeuvre,
      comportement: freshComportement(),
    });
    expect(agg.niveau).toBe("eleve");
  });

  it("un drapeau comportemental relève faible → vigilance", () => {
    const acheteur = assessActor(fullPerson(), clearScreening(), [], { ...ctx, montantEur: null });
    const oeuvre = assessArtwork(cleanArtwork()); // faible
    const comportement = freshComportement().map((q) =>
      q.id === "paiement_especes" ? { ...q, reponse: true } : q,
    );
    const agg = aggregateTransaction({
      montantEur: 5000,
      acheteur,
      vendeur: null,
      oeuvre,
      comportement,
    });
    expect(agg.niveau).toBe("vigilance");
  });
});

/* ───────────────── Invariants divers ───────────────── */

describe("checklists & métadonnées", () => {
  it("les checklists vierges démarrent toutes à « non renseigné »", () => {
    expect(freshActorIndices().every((q) => q.reponse === null)).toBe(true);
    expect(freshArtworkAudit().every((q) => q.reponse === null)).toBe(true);
    expect(freshComportement().every((q) => q.reponse === null)).toBe(true);
    expect(freshArtworkAudit().length).toBeGreaterThanOrEqual(4);
  });

  it("RISK_META et TIER_META sont complètes", () => {
    expect(RISK_META.eleve.label).toBeTruthy();
    expect(RISK_META.faible.label).toBeTruthy();
    expect(TIER_META.renforcee.label).toContain("renforcée");
    expect(TIER_META.simplifiee.label).toContain("simplifiée");
  });
});
