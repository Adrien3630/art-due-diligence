import { describe, it, expect } from "vitest";
import {
  assessJurisdiction,
  JURISDICTION_LABEL,
  GAFI_SNAPSHOT_DATE,
  GAFI_SNAPSHOT_ISO,
  gafiSnapshotAgeMonths,
  isGafiSnapshotStale,
} from "../jurisdictions";

describe("assessJurisdiction", () => {
  it("classe les pays « appel à l'action » en high", () => {
    expect(assessJurisdiction("Iran")).toBe("high");
    expect(assessJurisdiction("Corée du Nord")).toBe("high");
    expect(assessJurisdiction("Birmanie")).toBe("high");
    expect(assessJurisdiction("Myanmar")).toBe("high");
  });

  it("classe les pays « surveillance renforcée » (liste grise juin 2026) en monitored", () => {
    expect(assessJurisdiction("Monaco")).toBe("monitored");
    expect(assessJurisdiction("Venezuela")).toBe("monitored");
    expect(assessJurisdiction("Bulgarie")).toBe("monitored");
  });

  it("reflète les ENTRÉES de la plénière de juin 2026", () => {
    expect(assessJurisdiction("Bolivie")).toBe("monitored");
    expect(assessJurisdiction("Bosnie-Herzégovine")).toBe("monitored");
    expect(assessJurisdiction("Irak")).toBe("monitored");
    expect(assessJurisdiction("Koweït")).toBe("monitored");
    expect(assessJurisdiction("Papouasie-Nouvelle-Guinée")).toBe("monitored");
    expect(assessJurisdiction("Îles Vierges britanniques")).toBe("monitored");
  });

  it("reflète les SORTIES de liste grise (ne sont plus monitored)", () => {
    // Retirés entre juin 2025 et juin 2026 : ne doivent plus être signalés.
    for (const pays of [
      "Nigeria",
      "Afrique du Sud",
      "Algérie",
      "Croatie",
      "Mali",
      "Tanzanie",
      "Burkina Faso",
      "Mozambique",
      "Namibie",
    ]) {
      expect(assessJurisdiction(pays)).toBe("none");
    }
  });

  it("classe les pays hors liste en none", () => {
    expect(assessJurisdiction("France")).toBe("none");
    expect(assessJurisdiction("Allemagne")).toBe("none");
    expect(assessJurisdiction("")).toBe("none");
  });

  it("est tolérant aux accents, à la casse et aux espaces", () => {
    expect(assessJurisdiction("IRAN")).toBe("high");
    expect(assessJurisdiction("  corée du nord  ")).toBe("high");
    expect(assessJurisdiction("Côte d'Ivoire")).toBe("monitored");
  });

  it("gère les correspondances partielles", () => {
    expect(assessJurisdiction("Iran, République islamique d'")).toBe("high");
  });

  it("expose des libellés et une date de snapshot", () => {
    expect(JURISDICTION_LABEL.high).toContain("Appel");
    expect(JURISDICTION_LABEL.monitored).toContain("Surveillance");
    expect(GAFI_SNAPSHOT_DATE).toBe("juin 2026");
    expect(GAFI_SNAPSHOT_ISO).toBe("2026-06-19");
  });
});

describe("garde-fou de péremption du snapshot GAFI", () => {
  it("n'est pas périmé peu après la plénière", () => {
    expect(isGafiSnapshotStale(new Date("2026-08-11"))).toBe(false);
    expect(gafiSnapshotAgeMonths(new Date("2026-08-11"))).toBe(2);
  });

  it("devient périmé au-delà de ~2 plénières (8 mois)", () => {
    expect(isGafiSnapshotStale(new Date("2027-02-20"))).toBe(true);
    expect(gafiSnapshotAgeMonths(new Date("2027-06-19"))).toBe(12);
  });

  it("ne renvoie jamais d'âge négatif (date antérieure au snapshot)", () => {
    expect(gafiSnapshotAgeMonths(new Date("2026-01-01"))).toBe(0);
  });
});
