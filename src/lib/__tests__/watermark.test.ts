import { describe, it, expect } from "vitest";
import { watermarkLabel } from "../watermark";

describe("watermarkLabel", () => {
  it("compose destination, galerie et date JJ/MM/AAAA", () => {
    expect(watermarkLabel("Galerie Lumière", "2026-08-12T10:00:00.000Z")).toBe(
      "DUE DILIGENCE LCB-FT — Galerie Lumière — 12/08/2026",
    );
  });

  it("tolère une galerie vide", () => {
    expect(watermarkLabel("  ", "2026-01-05T00:00:00.000Z")).toBe(
      "DUE DILIGENCE LCB-FT — [Galerie] — 05/01/2026",
    );
  });

  it("laisse la date brute si non ISO", () => {
    expect(watermarkLabel("X", "sans date")).toContain("sans date");
  });
});
