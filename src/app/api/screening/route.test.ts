import { describe, it, expect } from "vitest";
import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/screening", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/screening", () => {
  it("renvoie 400 si l'identité est incomplète", async () => {
    const res = await POST(req({ subject: {}, settings: {} }));
    expect(res.status).toBe(400);
  });

  it("renvoie 400 sur un corps invalide", async () => {
    const res = await POST(
      new Request("http://localhost/api/screening", { method: "POST", body: "pas du json" }),
    );
    expect(res.status).toBe(400);
  });

  it("sans clé API : mode démonstration honnête (non probant)", async () => {
    const res = await POST(
      req({
        subject: { kind: "personne", nom: "Dupont", prenoms: "Jean" },
        settings: { fournisseur: "sanctions_io", apiKey: "" },
      }),
    );
    const data = await res.json();
    expect(data.status).toBe("demo");
    expect(data.message).toMatch(/DÉMONSTRATION/);
    expect(data.fournisseur).toMatch(/démonstration/i);
  });

  it("le mode démo n'invente pas de correspondance pour un nom neutre", async () => {
    const res = await POST(
      req({ subject: { kind: "personne", nom: "Martin" }, settings: { apiKey: "" } }),
    );
    const data = await res.json();
    expect(data.matches).toHaveLength(0);
  });
});
