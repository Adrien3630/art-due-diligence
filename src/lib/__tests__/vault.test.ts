import { describe, it, expect, beforeEach } from "vitest";
import {
  changePassphrase,
  createVault,
  exportBlob,
  getContent,
  hasLegacyData,
  hasVault,
  importBlob,
  isUnlocked,
  lock,
  persist,
  regenerateRecovery,
  unlock,
  unlockWithRecovery,
} from "../vault";
import { DEFAULT_SETTINGS } from "../vault";
import {
  deriveKey,
  encryptJson,
  toBase64,
  randomBytes,
  PBKDF2_ITERATIONS,
} from "../crypto";
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

    expect((await unlock("bonne-phrase-1")).ok).toBe(true);
    expect(getContent()?.history.map((d) => d.id)).toEqual(["abc"]);
  });

  it("refuse une mauvaise phrase secrète", async () => {
    await createVault("la-vraie-phrase");
    lock();
    expect((await unlock("mauvaise-phrase")).ok).toBe(false);
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

describe("vault v2 — clé de récupération & changement de phrase", () => {
  it("rouvre le coffre avec la clé de récupération (phrase oubliée)", async () => {
    const { recoveryCode } = await createVault("phrase-initiale-longue");
    getContent()!.history.unshift(fakeDossier("rec"));
    await persist();
    lock();

    // La phrase est « oubliée » ; la clé de récupération rouvre le coffre.
    expect((await unlock("phrase-initiale-longue")).ok).toBe(true); // sanity
    lock();
    expect(await unlockWithRecovery(recoveryCode)).toBe(true);
    expect(getContent()?.history.map((d) => d.id)).toEqual(["rec"]);
  });

  it("rejette une clé de récupération incorrecte", async () => {
    await createVault("phrase-xyz-longue");
    lock();
    expect(await unlockWithRecovery("0000-0000-0000-0000")).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it("change la phrase sans re-chiffrer le contenu (ancienne invalide, nouvelle OK)", async () => {
    await createVault("ancienne-phrase-longue");
    getContent()!.history.unshift(fakeDossier("keep"));
    await persist();

    await changePassphrase("nouvelle-phrase-longue");
    lock();

    expect((await unlock("ancienne-phrase-longue")).ok).toBe(false);
    expect((await unlock("nouvelle-phrase-longue")).ok).toBe(true);
    expect(getContent()?.history.map((d) => d.id)).toEqual(["keep"]);
  });

  it("la clé de récupération survit à un changement de phrase", async () => {
    const { recoveryCode } = await createVault("phrase-un-longue");
    await changePassphrase("phrase-deux-longue");
    lock();
    expect(await unlockWithRecovery(recoveryCode)).toBe(true);
  });

  it("régénère la clé de récupération (l'ancienne cesse d'ouvrir)", async () => {
    const { recoveryCode: old } = await createVault("phrase-regen-longue");
    const fresh = await regenerateRecovery();
    expect(fresh).not.toBe(old);
    lock();
    expect(await unlockWithRecovery(old)).toBe(false);
    expect(await unlockWithRecovery(fresh)).toBe(true);
  });

  it("migre un coffre v1 (PBKDF2) vers v2 au déverrouillage", async () => {
    const ls = (globalThis as unknown as { window: { localStorage: MemStorage } })
      .window.localStorage;
    // Fabrique un blob v1 hérité (contenu chiffré directement par la clé PBKDF2).
    const salt = randomBytes(16);
    const key = await deriveKey("phrase-v1", salt, PBKDF2_ITERATIONS);
    const sealed = await encryptJson(key, {
      settings: DEFAULT_SETTINGS,
      history: [fakeDossier("old")],
    });
    ls.setItem(
      "provenance.vault.v1",
      JSON.stringify({ v: 1, salt: toBase64(salt), iterations: PBKDF2_ITERATIONS, sealed }),
    );

    const res = await unlock("phrase-v1");
    expect(res.ok).toBe(true);
    expect(res.recoveryCode).toBeTruthy(); // clé de récupération générée à la migration
    expect(getContent()?.history.map((d) => d.id)).toEqual(["old"]);

    // Le coffre est désormais v2, réouvrable avec la même phrase et la clé.
    const raw = JSON.parse((await exportBlob())!) as { v: number };
    expect(raw.v).toBe(2);
    lock();
    expect((await unlock("phrase-v1")).ok).toBe(true);
    expect(await unlockWithRecovery(res.recoveryCode!)).toBe(true);
  });
});
