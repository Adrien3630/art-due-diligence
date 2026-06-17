import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveDossier, upsertDossier } from "../storage";
import { createVault, lock } from "../vault";
import type { Dossier } from "../types";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  lock();
  (globalThis as unknown as { window: unknown }).window = { localStorage: new MemStorage() };
});

const dossier = (id: string, niveau = "faible") =>
  ({ id, kind: "acteur", date: "2026-01-01", auditTrail: [], decision: null, assessment: { niveau } }) as unknown as Dossier;

describe("upsertDossier", () => {
  it("ajoute un nouveau dossier en tête", async () => {
    await createVault("phrase-test-123");
    await saveDossier(dossier("a"));
    await upsertDossier(dossier("b"));
    expect(loadHistory().map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("remplace un dossier existant sans créer de doublon (réouverture)", async () => {
    await createVault("phrase-test-123");
    await saveDossier(dossier("a", "faible"));
    // Ré-archive du même id après retraitement.
    await upsertDossier(dossier("a", "eleve"));
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect((h[0] as unknown as { assessment: { niveau: string } }).assessment.niveau).toBe("eleve");
  });
});
