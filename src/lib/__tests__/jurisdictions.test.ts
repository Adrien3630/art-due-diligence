import { describe, it, expect } from "vitest";
import {
  assessJurisdiction,
  JURISDICTION_LABEL,
  GAFI_SNAPSHOT_DATE,
} from "../jurisdictions";

describe("assessJurisdiction", () => {
  it("classe les pays « appel à l'action » en high", () => {
    expect(assessJurisdiction("Iran")).toBe("high");
    expect(assessJurisdiction("Corée du Nord")).toBe("high");
    expect(assessJurisdiction("Birmanie")).toBe("high");
    expect(assessJurisdiction("Myanmar")).toBe("high");
  });

  it("classe les pays « surveillance renforcée » en monitored", () => {
    expect(assessJurisdiction("Monaco")).toBe("monitored");
    expect(assessJurisdiction("Nigeria")).toBe("monitored");
    expect(assessJurisdiction("Venezuela")).toBe("monitored");
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
    expect(typeof GAFI_SNAPSHOT_DATE).toBe("string");
  });
});
