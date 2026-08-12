import { describe, it, expect } from "vitest";
import {
  matchSanctions,
  localScreening,
  isSanctionsSnapshotStale,
  snapshotAgeDays,
  type SanctionsSnapshot,
} from "../sanctions";
import type { ScreeningSubject } from "../types";

const person = (nom: string, prenoms = "", dateNaissance = ""): ScreeningSubject => ({
  kind: "personne",
  nom,
  prenoms,
  dateNaissance,
});

function snapshot(seed: boolean): SanctionsSnapshot {
  return {
    version: "2026-08-12",
    source: "test",
    listes: ["UE", "OFAC SDN"],
    seed,
    entries: [
      {
        id: "1",
        nom: "Ivan Petrov",
        alias: ["Ivan Petroff"],
        type: "personne",
        listes: ["UE", "OFAC SDN"],
        naissance: "1965",
        programme: "TEST",
      },
      {
        id: "2",
        nom: "Global Arms Ltd",
        type: "entite",
        listes: ["ONU"],
        programme: "TEST",
      },
    ],
  };
}

describe("matchSanctions", () => {
  it("apparie malgré une variante orthographique", () => {
    const m = matchSanctions(person("Petrov", "Ivan"), snapshot(true));
    expect(m).toHaveLength(1);
    expect(m[0].type).toContain("Sanction");
    expect(m[0].listes).toContain("OFAC SDN");
  });

  it("désambiguïse par année de naissance (écarte un homonyme d'une autre année)", () => {
    const m = matchSanctions(person("Petrov", "Ivan", "1980-01-01"), snapshot(true));
    expect(m).toHaveLength(0);
  });

  it("ne renvoie rien pour un nom distinct", () => {
    expect(matchSanctions(person("Durand", "Paul"), snapshot(true))).toHaveLength(0);
  });
});

describe("localScreening — honnêteté du statut", () => {
  it("correspondance → statut sanction", () => {
    const r = localScreening(person("Ivan Petrov"), snapshot(true));
    expect(r.status).toBe("sanction");
    expect(r.listesInterrogees).toContain("UE");
  });

  it("aucun match sur une GRAINE → non probant (demo), jamais un faux « clear »", () => {
    const r = localScreening(person("Personne Inconnue"), snapshot(true));
    expect(r.status).toBe("demo");
    expect(r.message).toContain("NON PROBANT");
  });

  it("aucun match sur un snapshot COMPLET → clear probant", () => {
    const r = localScreening(person("Personne Inconnue"), snapshot(false));
    expect(r.status).toBe("clear");
  });
});

describe("fraîcheur du snapshot", () => {
  it("une graine est toujours considérée périmée", () => {
    expect(isSanctionsSnapshotStale(snapshot(true))).toBe(true);
  });

  it("un snapshot complet récent n'est pas périmé", () => {
    const now = new Date("2026-08-20T00:00:00Z");
    expect(isSanctionsSnapshotStale(snapshot(false), now)).toBe(false);
    expect(snapshotAgeDays(snapshot(false), now)).toBe(8);
  });

  it("un snapshot complet ancien est périmé", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(isSanctionsSnapshotStale(snapshot(false), now)).toBe(true);
  });
});
