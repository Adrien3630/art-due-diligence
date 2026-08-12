import { describe, it, expect } from "vitest";
import {
  freshRegisterChecks,
  withPrefilledUrls,
  registerDescription,
  registerReview,
  attestationDetail,
  REGISTER_RESULT_LABEL,
} from "../registers";
import type { RegisterCheck } from "../types";

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

describe("attestation de revue (honnête)", () => {
  function checks(): RegisterCheck[] {
    return freshRegisterChecks();
  }

  it("suit l'avancement de la revue", () => {
    const c = checks();
    expect(registerReview(c).tousConstates).toBe(false);
    expect(registerReview(c).restants).toBe(c.length);

    const constate = c.map((x, i) =>
      i === 0 ? { ...x, resultat: "correspondance" as const } : { ...x, resultat: "aucune" as const },
    );
    const r = registerReview(constate);
    expect(r.tousConstates).toBe(true);
    expect(r.restants).toBe(0);
    expect(r.correspondances).toBe(1);
  });

  it("reprend fidèlement ce qui a été constaté (aucune invention)", () => {
    const c = checks().map((x) => ({ ...x, resultat: "aucune" as const }));
    const detail = attestationDetail(c, "M. Test");
    expect(detail).toContain("attestée par M. Test");
    expect(detail).toContain("Aucune correspondance");
  });
});
