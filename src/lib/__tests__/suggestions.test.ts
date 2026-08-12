import { describe, it, expect } from "vitest";
import { suggest, prefillFromSettings } from "../suggestions";
import type { Actor, Artwork, Dossier } from "../types";
import { emptyActor, emptyArtwork } from "../factories";
import { DEFAULT_SETTINGS } from "../vault";

function actorDossier(a: Partial<Actor>, id: string): Dossier {
  return {
    id,
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

function oeuvreDossier(a: Partial<Artwork>, id: string): Dossier {
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

const history: Dossier[] = [
  actorDossier({ nationalite: "Française", pays: "France" }, "a1"),
  actorDossier({ nationalite: "Italienne", pays: "Italie" }, "a2"),
  actorDossier({ nationalite: "Française", pays: "France" }, "a3"), // doublon
  oeuvreDossier({ artiste: "Picasso", technique: "Huile sur toile" }, "o1"),
  oeuvreDossier({ artiste: "Monet", technique: "Huile sur toile" }, "o2"),
];

describe("suggest", () => {
  it("dédoublonne et trie les valeurs vues", () => {
    expect(suggest(history, "nationalite")).toEqual(["Française", "Italienne"]);
  });

  it("propose les artistes déjà saisis", () => {
    expect(suggest(history, "artiste")).toEqual(["Monet", "Picasso"]);
  });

  it("filtre par préfixe en priorité", () => {
    expect(suggest(history, "artiste", "pic")).toEqual(["Picasso"]);
  });

  it("dédoublonne les techniques", () => {
    expect(suggest(history, "technique")).toEqual(["Huile sur toile"]);
  });

  it("liste vide si aucune valeur", () => {
    expect(suggest([], "pays")).toEqual([]);
  });
});

describe("prefillFromSettings", () => {
  it("extrait galerie et signataire", () => {
    const s = { ...DEFAULT_SETTINGS, nomGalerie: "Galerie X ", signataire: " Mme Y" };
    expect(prefillFromSettings(s)).toEqual({ nomGalerie: "Galerie X", signataire: "Mme Y" });
  });
});
