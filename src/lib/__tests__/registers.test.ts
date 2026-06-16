import { describe, it, expect } from "vitest";
import {
  freshRegisterChecks,
  withPrefilledUrls,
  registerDescription,
  REGISTER_RESULT_LABEL,
} from "../registers";

describe("registres vol / spoliation", () => {
  it("fournit une liste vierge avec vol ET spoliation, tous « non vérifié »", () => {
    const checks = freshRegisterChecks();
    expect(checks.length).toBeGreaterThanOrEqual(6);
    expect(checks.every((c) => c.resultat === "non_verifie")).toBe(true);
    expect(checks.some((c) => c.kind === "vol")).toBe(true);
    expect(checks.some((c) => c.kind === "spoliation")).toBe(true);
  });

  it("pré-remplit l'URL avec artiste + titre pour les registres qui le supportent", () => {
    const checks = withPrefilledUrls(freshRegisterChecks(), {
      artiste: "Max Liebermann",
      titre: "Paysage",
    });
    const lostart = checks.find((c) => c.id === "lostart_de");
    expect(lostart?.url).toContain(encodeURIComponent("Max Liebermann Paysage"));
  });

  it("laisse l'URL sans paramètre pour les registres sans recherche par requête", () => {
    const checks = withPrefilledUrls(freshRegisterChecks(), {
      artiste: "ZZTOP",
      titre: "QWERTY",
    });
    const interpol = checks.find((c) => c.id === "interpol");
    expect(interpol?.url).not.toContain("ZZTOP");
  });

  it("expose descriptions et libellés de résultat", () => {
    expect(registerDescription("interpol")).toBeTruthy();
    expect(REGISTER_RESULT_LABEL.correspondance).toBe("Correspondance trouvée");
    expect(REGISTER_RESULT_LABEL.non_verifie).toBe("Non vérifié");
  });
});
