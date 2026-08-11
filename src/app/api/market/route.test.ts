import { describe, it, expect } from "vitest";
import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const aucun = { marcheFournisseur: "aucun", marcheApiKey: "", marcheEndpoint: "" };

describe("POST /api/market", () => {
  it("renvoie 400 si l'artiste est absent", async () => {
    const res = await POST(req({ artiste: "", settings: aucun }));
    expect(res.status).toBe(400);
  });

  it("sans fournisseur : mode démonstration non probant, fourchette calculée", async () => {
    const res = await POST(req({ artiste: "Pierre Soulages", settings: aucun }));
    const data = await res.json();
    expect(data.status).toBe("demo");
    expect(data.message).toMatch(/DÉMONSTRATION/);
    expect(data.comparables.length).toBeGreaterThan(0);
    // min/médiane/max cohérents sur les comparables d'exemple.
    expect(data.fourchetteEur.min).toBeLessThanOrEqual(data.fourchetteEur.mediane);
    expect(data.fourchetteEur.mediane).toBeLessThanOrEqual(data.fourchetteEur.max);
  });

  it("retombe en démo si le fournisseur est configuré sans clé/endpoint", async () => {
    const res = await POST(
      req({ artiste: "X", settings: { marcheFournisseur: "artnet", marcheApiKey: "", marcheEndpoint: "" } }),
    );
    const data = await res.json();
    expect(data.status).toBe("demo");
  });
});
