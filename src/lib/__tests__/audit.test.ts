import { describe, it, expect } from "vitest";
import { buildTrail, appendEvent, verifyTrail } from "../audit";

describe("piste d'audit chaînée (tamper-evident)", () => {
  it("construit une chaîne valide et chaînée", async () => {
    const trail = await buildTrail([
      { type: "dossier_cree", detail: "A" },
      { type: "screening_resultat", detail: "B" },
      { type: "decision_saisie", detail: "C" },
    ]);
    expect(trail).toHaveLength(3);
    expect(trail[0].hashPrec).toBe("GENESIS");
    expect(trail[1].hashPrec).toBe(trail[0].hash);
    expect(trail[2].hashPrec).toBe(trail[1].hash);
    expect(await verifyTrail(trail)).toBe(true);
  });

  it("append chaîne sur le hash du dernier événement", async () => {
    let trail = await buildTrail([{ type: "dossier_cree", detail: "A" }]);
    const before = trail[0].hash;
    trail = await appendEvent(trail, "decision_saisie", "D");
    expect(trail[1].hashPrec).toBe(before);
    expect(await verifyTrail(trail)).toBe(true);
  });

  it("détecte l'altération du contenu d'un événement passé", async () => {
    const trail = await buildTrail([
      { type: "dossier_cree", detail: "A" },
      { type: "decision_saisie", detail: "B" },
    ]);
    const tampered = trail.map((e, i) => (i === 0 ? { ...e, detail: "MODIFIÉ" } : e));
    expect(await verifyTrail(tampered)).toBe(false);
  });

  it("détecte la suppression d'un événement intermédiaire", async () => {
    const trail = await buildTrail([
      { type: "dossier_cree", detail: "A" },
      { type: "screening_resultat", detail: "B" },
      { type: "decision_saisie", detail: "C" },
    ]);
    const tampered = [trail[0], trail[2]].map((e, i) => ({ ...e, seq: i }));
    expect(await verifyTrail(tampered)).toBe(false);
  });

  it("une chaîne vide est considérée valide", async () => {
    expect(await verifyTrail([])).toBe(true);
  });
});
