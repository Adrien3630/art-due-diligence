import { describe, it, expect } from "vitest";
import {
  actorCompletion,
  artworkCompletion,
  transactionCompletion,
} from "../completion";
import { emptyActor, emptyArtwork } from "../factories";
import { assessActor } from "../scoring";
import type { ScreeningResult } from "../types";

const clear: ScreeningResult = {
  sujet: "x",
  status: "clear",
  matches: [],
  listesInterrogees: [],
  fournisseur: "test",
  horodatage: "2026-01-01T00:00:00.000Z",
  desambiguise: false,
};

const CTX = { seuilVigilanceEur: 10000, montantEur: null };

describe("actorCompletion", () => {
  it("acteur vide → 0 % et prochaine étape = nom", () => {
    const a = emptyActor();
    const c = actorCompletion(a, assessActor(a, clear, [], CTX));
    expect(c.pct).toBe(0);
    expect(c.nextStep).toBe("Nom");
  });

  it("personne renseignée en vigilance simplifiée → 100 %", () => {
    const a = {
      ...emptyActor(),
      nom: "Dupont",
      prenoms: "Jean",
      dateNaissance: "1970-01-01",
      nationalite: "Française",
      pays: "France",
    };
    const c = actorCompletion(a, assessActor(a, clear, [], CTX));
    expect(c.pct).toBe(100);
    expect(c.nextStep).toBeNull();
  });

  it("pièce d'identité due mais non téléversée → non complet", () => {
    const a = {
      ...emptyActor(),
      nom: "Dupont",
      prenoms: "Jean",
      dateNaissance: "1970-01-01",
      nationalite: "Française",
      pays: "France",
      transactionSuperieureSeuil: true, // force au moins la vigilance standard
    };
    const c = actorCompletion(a, assessActor(a, clear, [], CTX));
    const piece = c.items.find((i) => i.id.startsWith("piece_identite"));
    expect(piece?.done).toBe(false);
    expect(c.pct).toBeLessThan(100);
  });

  it("origine des fonds renseignée → la pièce « origine des fonds » est satisfaite", () => {
    // Un signal PPE force la vigilance renforcée → pièce origine des fonds due.
    const ppe: ScreeningResult = { ...clear, status: "ppe" };
    const a = {
      ...emptyActor(),
      nom: "Dupont",
      prenoms: "Jean",
      dateNaissance: "1970-01-01",
      nationalite: "Française",
      pays: "France",
      origineFonds: "Cession d'un bien immobilier (2024)",
    };
    const c = actorCompletion(a, assessActor(a, ppe, [], CTX));
    const piece = c.items.find((i) => i.id === "piece_origine_fonds");
    expect(piece?.done).toBe(true);
  });
});

describe("artworkCompletion", () => {
  it("œuvre vide → registres et champs manquants", () => {
    const c = artworkCompletion(emptyArtwork());
    expect(c.pct).toBeLessThan(100);
    const reg = c.items.find((i) => i.id === "registres");
    expect(reg?.done).toBe(false);
  });

  it("registres tous constatés → 100 %", () => {
    const art = emptyArtwork();
    art.titre = "Nature morte";
    art.artiste = "Picasso";
    art.provenance = [
      { id: "p1", periode: "1980", proprietaire: "Galerie X", lieu: "Paris", source: "", typeSource: "facture" },
    ];
    art.registres = art.registres.map((r) => ({ ...r, resultat: "aucune" as const }));
    art.redFlags = art.redFlags.map((r) => ({ ...r, reponse: false }));
    const c = artworkCompletion(art);
    expect(c.pct).toBe(100);
  });
});

describe("transactionCompletion", () => {
  it("agrège acheteur + œuvre", () => {
    const a = {
      ...emptyActor(),
      nom: "Dupont",
      prenoms: "Jean",
      dateNaissance: "1970-01-01",
      nationalite: "Française",
      pays: "France",
    };
    const c = transactionCompletion({
      montantEur: 5000,
      acheteur: { actor: a, assessment: assessActor(a, clear, [], CTX) },
      vendeur: null,
      oeuvre: emptyArtwork(),
    });
    expect(c.items.some((i) => i.label.startsWith("Acheteur"))).toBe(true);
    expect(c.items.some((i) => i.label.startsWith("Œuvre"))).toBe(true);
    expect(c.items[0].label).toBe("Montant de l'opération");
    expect(c.items[0].done).toBe(true);
  });
});
