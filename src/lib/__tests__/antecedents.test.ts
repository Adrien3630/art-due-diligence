import { describe, it, expect } from "vitest";
import {
  normalize,
  levenshtein,
  similarity,
  searchActors,
  searchArtworks,
} from "../antecedents";
import type { Actor, Artwork, Dossier } from "../types";
import { emptyActor, emptyArtwork } from "../factories";

describe("normalize", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(normalize("Müller-Lévy")).toBe("muller levy");
    expect(normalize("  Jean   DUPONT  ")).toBe("jean dupont");
  });
});

describe("levenshtein", () => {
  it("compte les éditions", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("chat", "chats")).toBe(1);
    expect(levenshtein("muller", "mueller")).toBe(1);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
});

describe("similarity", () => {
  it("tolère une faute de frappe", () => {
    expect(similarity("Dupont", "Dupomt")).toBeGreaterThan(0.8);
  });
  it("ignore l'ordre des mots", () => {
    expect(similarity("Jean Dupont", "Dupont Jean")).toBe(1);
  });
  it("récompense l'inclusion d'un terme", () => {
    expect(similarity("Dupont", "Jean Dupont")).toBeGreaterThanOrEqual(0.9);
  });
  it("sépare deux noms distincts", () => {
    expect(similarity("Dupont", "Martin")).toBeLessThan(0.5);
  });
});

function actorDossier(a: Partial<Actor>): Dossier {
  return {
    id: Math.random().toString(36).slice(2, 10),
    date: "2026-01-01T00:00:00.000Z",
    kind: "acteur",
    auditTrail: [],
    decision: null,
    actor: { ...emptyActor(), ...a },
    screening: {} as never,
    beneficiairesScreening: [],
    assessment: {} as never,
  };
}

function oeuvreDossier(a: Partial<Artwork>, id = "o1"): Dossier {
  return {
    id,
    date: "2026-02-01T00:00:00.000Z",
    kind: "oeuvre",
    auditTrail: [],
    decision: null,
    artwork: { ...emptyArtwork(), ...a },
    assessment: {} as never,
  };
}

describe("searchActors", () => {
  const history = [
    actorDossier({ nom: "Dupont", prenoms: "Jean" }),
    actorDossier({ nom: "Martin", prenoms: "Sophie" }),
  ];

  it("retrouve un acteur malgré une faute de frappe", () => {
    const r = searchActors(history, "Jean Dupomt");
    expect(r[0]?.nom).toBe("Jean Dupont");
    expect(r[0]?.actor.prenoms).toBe("Jean");
  });

  it("ne renvoie rien sous le seuil", () => {
    expect(searchActors(history, "Nakamura")).toEqual([]);
  });

  it("ignore les requêtes trop courtes", () => {
    expect(searchActors(history, "J")).toEqual([]);
  });

  it("exclut le dossier courant", () => {
    const id = history[0].id;
    expect(searchActors(history, "Jean Dupont", { excludeId: id })).toEqual([]);
  });
});

describe("searchArtworks", () => {
  const history = [
    oeuvreDossier({ titre: "Nature morte", artiste: "Picasso" }, "a"),
    oeuvreDossier({ titre: "Paysage", artiste: "Monet" }, "b"),
  ];

  it("retrouve une œuvre par titre approximatif", () => {
    const r = searchArtworks(history, "Nature mort Picaso");
    expect(r[0]?.artwork.artiste).toBe("Picasso");
  });

  it("retrouve par artiste seul", () => {
    const r = searchArtworks(history, "Monet");
    expect(r[0]?.artwork.titre).toBe("Paysage");
  });
});
