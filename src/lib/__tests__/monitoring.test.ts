import { describe, it, expect } from "vitest";
import {
  isVigilanceApplicable,
  lastReviewDate,
  monthsBetween,
  vigilanceDue,
} from "../monitoring";
import type { Dossier } from "../types";

const base = (over: Partial<Dossier>) =>
  ({ id: "x", date: "2025-01-15T00:00:00Z", auditTrail: [], decision: null, ...over }) as unknown as Dossier;

describe("monthsBetween", () => {
  it("compte les mois entiers écoulés", () => {
    expect(monthsBetween("2025-01-15T00:00:00Z", "2025-01-20T00:00:00Z")).toBe(0);
    expect(monthsBetween("2025-01-15T00:00:00Z", "2025-02-14T00:00:00Z")).toBe(0);
    expect(monthsBetween("2025-01-15T00:00:00Z", "2025-02-15T00:00:00Z")).toBe(1);
    expect(monthsBetween("2025-01-15T00:00:00Z", "2026-01-15T00:00:00Z")).toBe(12);
  });

  it("ne renvoie jamais de valeur négative", () => {
    expect(monthsBetween("2026-01-15T00:00:00Z", "2025-01-15T00:00:00Z")).toBe(0);
  });
});

describe("lastReviewDate", () => {
  it("utilise derniereRevue si présente, sinon la date de création", () => {
    expect(lastReviewDate(base({ kind: "acteur" }))).toBe("2025-01-15T00:00:00Z");
    expect(
      lastReviewDate(base({ kind: "acteur", derniereRevue: "2025-06-01T00:00:00Z" })),
    ).toBe("2025-06-01T00:00:00Z");
  });
});

describe("isVigilanceApplicable", () => {
  it("s'applique aux acteurs et transactions, pas aux œuvres", () => {
    expect(isVigilanceApplicable(base({ kind: "acteur" }))).toBe(true);
    expect(isVigilanceApplicable(base({ kind: "transaction" }))).toBe(true);
    expect(isVigilanceApplicable(base({ kind: "oeuvre" }))).toBe(false);
  });
});

describe("vigilanceDue", () => {
  const now = "2026-02-01T00:00:00Z";
  it("signale un dossier acteur plus vieux que l'intervalle", () => {
    expect(vigilanceDue(base({ kind: "acteur" }), 12, now)).toBe(true); // ~12,5 mois
  });
  it("ne signale pas un dossier récent", () => {
    expect(
      vigilanceDue(base({ kind: "acteur", derniereRevue: "2026-01-01T00:00:00Z" }), 12, now),
    ).toBe(false);
  });
  it("ne signale jamais une œuvre", () => {
    expect(vigilanceDue(base({ kind: "oeuvre" }), 1, now)).toBe(false);
  });
  it("respecte l'intervalle configuré", () => {
    expect(vigilanceDue(base({ kind: "transaction" }), 6, now)).toBe(true);
    expect(vigilanceDue(base({ kind: "transaction" }), 24, now)).toBe(false);
  });
});
