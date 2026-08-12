import { describe, it, expect } from "vitest";
import { estimatePassphrase, PASS_MIN_LEN } from "../passphrase";

describe("estimatePassphrase", () => {
  it("rejette le vide et les mots de passe courants", () => {
    expect(estimatePassphrase("").acceptable).toBe(false);
    expect(estimatePassphrase("password").acceptable).toBe(false);
    expect(estimatePassphrase("azerty").score).toBe(0);
  });

  it("rejette une phrase trop courte même si variée", () => {
    const r = estimatePassphrase("aB3$xY"); // 6 caractères
    expect(r.acceptable).toBe(false);
    expect(r.hint).toContain("Trop courte");
  });

  it("pénalise la répétition triviale", () => {
    expect(estimatePassphrase("abababababab").score).toBeLessThanOrEqual(1);
  });

  it("valorise une vraie phrase de passe (plusieurs mots)", () => {
    const r = estimatePassphrase("cerise-tortue-lampe-nord");
    expect(r.acceptable).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });

  it("accepte un secret long et varié", () => {
    const r = estimatePassphrase("Gx7!vunq-42Lm.pQ");
    expect(r.acceptable).toBe(true);
    expect(r.bits).toBeGreaterThan(60);
  });

  it("expose une longueur minimale", () => {
    expect(PASS_MIN_LEN).toBeGreaterThanOrEqual(12);
  });
});
