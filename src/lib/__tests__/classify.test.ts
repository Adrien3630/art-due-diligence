import { describe, it, expect } from "vitest";
import { classifyMatches, effectiveStatus } from "../classify";
import type { ScreeningMatch } from "../types";

function m(type: string, ecarte = false): ScreeningMatch {
  return { nom: "X", listes: ["Liste"], type, score: 90, ecarte };
}

describe("classifyMatches", () => {
  it("hiérarchise sanction > PPE > média > clear", () => {
    expect(classifyMatches([m("Sanction")])).toBe("sanction");
    expect(classifyMatches([m("PEP")])).toBe("ppe");
    expect(classifyMatches([m("Adverse media")])).toBe("media");
    expect(classifyMatches([])).toBe("clear");
  });

  it("ignore les correspondances écartées (faux positifs)", () => {
    expect(classifyMatches([m("Sanction", true)])).toBe("clear");
    expect(classifyMatches([m("Sanction", true), m("PEP")])).toBe("ppe");
  });

  it("détecte la sanction aussi via le nom de liste", () => {
    expect(
      classifyMatches([{ nom: "X", listes: ["OFAC SDN"], type: "Entité", score: 90 }]),
    ).toBe("sanction");
  });
});

describe("effectiveStatus", () => {
  it("conserve les statuts non probants (demo / error)", () => {
    expect(effectiveStatus("demo", [m("Sanction")])).toBe("demo");
    expect(effectiveStatus("error", [])).toBe("error");
  });

  it("recalcule à partir des correspondances actives", () => {
    expect(effectiveStatus("sanction", [m("Sanction", true)])).toBe("clear");
  });
});
