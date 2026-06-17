import { describe, it, expect, beforeEach } from "vitest";
import {
  createVault,
  exportBlob,
  getContent,
  hasLegacyData,
  hasVault,
  importBlob,
  isUnlocked,
  lock,
  persist,
  unlock,
} from "../vault";
import type { Dossier } from "../types";

// localStorage minimal en mémoire pour exécuter le coffre hors navigateur.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  lock();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: new MemStorage(),
  };
});

const fakeDossier = (id: string) =>
  ({ id, kind: "acteur", date: "2026-01-01", auditTrail: [], decision: null }) as unknown as Dossier;

describe("vault", () => {
  it("crée un coffre et le déverrouille immédiatement", async () => {
    expect(await hasVault()).toBe(false);
    await createVault("phrase-secrète-longue");
    expect(isUnlocked()).toBe(true);
    expect(await hasVault()).toBe(true);
    expect(getContent()?.history).toEqual([]);
  });

  it("persiste, verrouille et redéverrouille avec la bonne phrase", async () => {
    await createVault("bonne-phrase-1");
    getContent()!.history.unshift(fakeDossier("abc"));
    await persist();
    lock();
    expect(isUnlocked()).toBe(false);
    expect(getContent()).toBeNull();

    expect(await unlock("bonne-phrase-1")).toBe(true);
    expect(getContent()?.history.map((d) => d.id)).toEqual(["abc"]);
  });

  it("refuse une mauvaise phrase secrète", async () => {
    await createVault("la-vraie-phrase");
    lock();
    expect(await unlock("mauvaise-phrase")).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it("migre les données en clair héritées puis les supprime", async () => {
    const ls = (globalThis as unknown as { window: { localStorage: MemStorage } })
      .window.localStorage;
    ls.setItem("provenance.settings.v2", JSON.stringify({ nomGalerie: "Galerie X" }));
    ls.setItem("provenance.history.v3", JSON.stringify([fakeDossier("legacy")]));
    expect(hasLegacyData()).toBe(true);

    await createVault("phrase-migration");
    expect(getContent()?.settings.nomGalerie).toBe("Galerie X");
    expect(getContent()?.history.map((d) => d.id)).toEqual(["legacy"]);
    // Les copies en clair ont été retirées.
    expect(hasLegacyData()).toBe(false);
    expect(ls.getItem("provenance.history.v3")).toBeNull();
  });

  it("exporte un blob chiffré réimportable avec la phrase", async () => {
    await createVault("phrase-export");
    getContent()!.history.unshift(fakeDossier("xyz"));
    await persist();
    const blob = await exportBlob();
    expect(blob).toBeTruthy();
    // Le blob exporté ne contient pas l'id en clair (il est chiffré).
    expect(blob!).not.toContain("xyz");

    lock();
    expect(await importBlob(blob!, "phrase-export")).toBe(true);
    expect(getContent()?.history.map((d) => d.id)).toEqual(["xyz"]);
  });

  it("refuse un import avec une mauvaise phrase", async () => {
    await createVault("phrase-a");
    await persist();
    const blob = (await exportBlob())!;
    lock();
    expect(await importBlob(blob, "phrase-b")).toBe(false);
  });
});
