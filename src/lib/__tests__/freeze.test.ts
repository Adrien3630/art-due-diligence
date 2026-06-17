import { describe, it, expect } from "vitest";
import {
  buildFreezeNotice,
  freezeHits,
  hasFreezeObligation,
  DGTRESOR_EMAIL,
} from "../freeze";
import type {
  ActorDossier,
  Dossier,
  ScreeningMatch,
  ScreeningResult,
  TransactionDossier,
} from "../types";

function screening(
  status: ScreeningResult["status"],
  sujet: string,
  matches: ScreeningMatch[] = [],
): ScreeningResult {
  return {
    sujet,
    status,
    matches,
    listesInterrogees: [],
    fournisseur: "test",
    horodatage: "2026-01-01T00:00:00Z",
    desambiguise: false,
  };
}

const sanctionMatch = (listes: string[], ecarte = false): ScreeningMatch => ({
  nom: "X",
  listes,
  type: "Sanction",
  score: 95,
  ecarte,
});

function actorDossier(s: ScreeningResult, bens: ScreeningResult[] = []): ActorDossier {
  return {
    id: "d1",
    date: "2026-01-01T00:00:00Z",
    kind: "acteur",
    screening: s,
    beneficiairesScreening: bens,
    auditTrail: [],
    decision: null,
  } as unknown as ActorDossier;
}

describe("freezeHits / hasFreezeObligation", () => {
  it("détecte une correspondance de sanction sur l'acteur", () => {
    const d = actorDossier(
      screening("sanction", "Jean Sanctionné", [sanctionMatch(["OFAC SDN", "EU Consolidated"])]),
    );
    expect(hasFreezeObligation(d)).toBe(true);
    const hits = freezeHits(d);
    expect(hits).toHaveLength(1);
    expect(hits[0].sujet).toBe("Jean Sanctionné");
    expect(hits[0].listes).toEqual(["OFAC SDN", "EU Consolidated"]);
  });

  it("ne déclenche rien pour un statut clear/ppe/demo", () => {
    expect(hasFreezeObligation(actorDossier(screening("clear", "A")))).toBe(false);
    expect(hasFreezeObligation(actorDossier(screening("ppe", "B")))).toBe(false);
    expect(hasFreezeObligation(actorDossier(screening("demo", "C")))).toBe(false);
  });

  it("exclut les correspondances écartées (faux positifs) des listes", () => {
    const d = actorDossier(
      screening("sanction", "Sujet", [
        sanctionMatch(["LISTE-A"]),
        sanctionMatch(["LISTE-ECARTEE"], true),
      ]),
    );
    expect(freezeHits(d)[0].listes).toEqual(["LISTE-A"]);
  });

  it("détecte un hit sur un bénéficiaire effectif", () => {
    const d = actorDossier(screening("clear", "Entité"), [
      screening("sanction", "UBO sanctionné", [sanctionMatch(["UN"])]),
    ]);
    expect(hasFreezeObligation(d)).toBe(true);
    expect(freezeHits(d)[0].sujet).toBe("UBO sanctionné");
  });

  it("détecte un hit sur le vendeur d'une transaction", () => {
    const d = {
      id: "t1",
      date: "2026-01-01T00:00:00Z",
      kind: "transaction",
      acheteur: { screening: screening("clear", "Acheteur"), beneficiairesScreening: [] },
      vendeur: {
        screening: screening("sanction", "Vendeur sanctionné", [sanctionMatch(["EU"])]),
        beneficiairesScreening: [],
      },
    } as unknown as TransactionDossier;
    expect(hasFreezeObligation(d)).toBe(true);
    expect(freezeHits(d)[0].sujet).toBe("Vendeur sanctionné");
  });

  it("ne s'applique pas à un dossier œuvre", () => {
    const d = { id: "o1", date: "2026-01-01T00:00:00Z", kind: "oeuvre" } as unknown as Dossier;
    expect(hasFreezeObligation(d)).toBe(false);
  });
});

describe("buildFreezeNotice", () => {
  it("cite la base légale, le contact DG Trésor et le sujet", () => {
    const d = actorDossier(
      screening("sanction", "Jean Sanctionné", [sanctionMatch(["OFAC SDN"])]),
    );
    const notice = buildFreezeNotice(d, { nomGalerie: "Galerie Y", signataire: "Dupont" });
    expect(notice.corps).toContain("L. 562-4");
    expect(notice.corps).toContain(DGTRESOR_EMAIL);
    expect(notice.corps).toContain("Jean Sanctionné");
    expect(notice.corps).toContain("Galerie Y");
  });
});
