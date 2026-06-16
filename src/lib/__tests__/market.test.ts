import { describe, it, expect } from "vitest";
import { assessPriceCoherence, MARKET_STATUS_LABEL } from "../market";
import type { MarketResult } from "../types";

const okResult = (
  min: number,
  max: number,
  mediane: number,
): Pick<MarketResult, "status" | "fourchetteEur"> => ({
  status: "ok",
  fourchetteEur: { min, max, mediane },
});

describe("assessPriceCoherence", () => {
  it("renvoie indéterminé sans montant", () => {
    const c = assessPriceCoherence(null, okResult(10000, 50000, 30000));
    expect(c.verdict).toBe("indetermine");
    expect(c.suggereDrapeau).toBe(false);
  });

  it("renvoie indéterminé sans comparables probants", () => {
    expect(assessPriceCoherence(20000, null).verdict).toBe("indetermine");
    expect(
      assessPriceCoherence(20000, { status: "demo", fourchetteEur: { min: 1, max: 2, mediane: 1 } }).verdict,
    ).toBe("indetermine");
    expect(
      assessPriceCoherence(20000, { status: "error", fourchetteEur: null }).suggereDrapeau,
    ).toBe(false);
  });

  it("juge cohérent un prix dans la fourchette", () => {
    const c = assessPriceCoherence(30000, okResult(10000, 50000, 30000));
    expect(c.verdict).toBe("coherent");
    expect(c.suggereDrapeau).toBe(false);
  });

  it("tolère un prix légèrement hors fourchette (tolérance de marché)", () => {
    // 60000 > max(50000) mais < 1.5×max(75000) → cohérent
    expect(assessPriceCoherence(60000, okResult(10000, 50000, 30000)).verdict).toBe("coherent");
    // 6000 < min(10000) mais > 0.5×min(5000) → cohérent
    expect(assessPriceCoherence(6000, okResult(10000, 50000, 30000)).verdict).toBe("coherent");
  });

  it("signale et suggère un drapeau pour un prix anormalement élevé", () => {
    const c = assessPriceCoherence(100000, okResult(10000, 50000, 30000));
    expect(c.verdict).toBe("eleve");
    expect(c.suggereDrapeau).toBe(true);
  });

  it("signale et suggère un drapeau pour un prix anormalement bas", () => {
    const c = assessPriceCoherence(3000, okResult(10000, 50000, 30000));
    expect(c.verdict).toBe("bas");
    expect(c.suggereDrapeau).toBe(true);
  });

  it("expose des libellés de statut", () => {
    expect(MARKET_STATUS_LABEL.demo).toContain("non probant");
    expect(MARKET_STATUS_LABEL.ok).toBeTruthy();
  });
});
