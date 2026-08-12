import { describe, it, expect } from "vitest";
import {
  toIsoDate,
  parseMrz,
  parseIdentityText,
  parseEntityText,
  parseBeneficiaries,
} from "../ocr";

const NOW = new Date("2026-08-11T00:00:00Z");

describe("toIsoDate", () => {
  it("normalise les séparateurs courants", () => {
    expect(toIsoDate("12.05.1980")).toBe("1980-05-12");
    expect(toIsoDate("12/05/1980")).toBe("1980-05-12");
    expect(toIsoDate("3 7 1962")).toBe("1962-07-03");
  });
  it("gère l'année sur 2 chiffres (bascule de siècle)", () => {
    expect(toIsoDate("12.05.80", NOW)).toBe("1980-05-12");
    expect(toIsoDate("12.05.10", NOW)).toBe("2010-05-12");
  });
  it("rejette une date invalide", () => {
    expect(toIsoDate("32.13.1980")).toBeUndefined();
    expect(toIsoDate("pas une date")).toBeUndefined();
  });
});

describe("parseMrz", () => {
  it("lit un MRZ de passeport (nom, prénoms, nationalité, naissance)", () => {
    const mrz = [
      "P<FRADUPONT<<JEAN<PAUL<<<<<<<<<<<<<<<<<<<<<<<",
      "19HA34828FRA8005121M3001019<<<<<<<<<<<<<<02",
    ].join("\n");
    const r = parseMrz(mrz, NOW);
    expect(r?.nom).toBe("DUPONT");
    expect(r?.prenoms).toBe("JEAN PAUL");
    expect(r?.nationalite).toBe("Française");
    expect(r?.dateNaissance).toBe("1980-05-12");
  });
  it("renvoie null sans zone MRZ", () => {
    expect(parseMrz("Carte nationale d'identité", NOW)).toBeNull();
  });
});

describe("parseIdentityText — texte étiqueté", () => {
  it("extrait les champs d'une CNI océrisée (hors MRZ)", () => {
    const text = [
      "RÉPUBLIQUE FRANÇAISE",
      "Nom : MARTIN",
      "Prénoms : Sophie Claire",
      "Né(e) le 03.07.1962",
      "Nationalité : Française",
    ].join("\n");
    const r = parseIdentityText(text, NOW);
    expect(r.nom).toBe("MARTIN");
    expect(r.prenoms).toBe("Sophie Claire");
    expect(r.dateNaissance).toBe("1962-07-03");
    expect(r.nationalite).toBe("Française");
  });
  it("ne propose que ce qu'il trouve (aucun champ inventé)", () => {
    expect(parseIdentityText("document illisible", NOW)).toEqual({});
  });
});

describe("parseEntityText — Kbis / extrait", () => {
  it("extrait le SIREN et la dénomination", () => {
    const text = [
      "Extrait Kbis",
      "Dénomination : GALERIE LUMIÈRE SARL",
      "SIREN 123 456 789",
    ].join("\n");
    const r = parseEntityText(text);
    expect(r.immatriculation).toBe("123456789");
    expect(r.nom).toBe("GALERIE LUMIÈRE SARL");
  });
});

describe("parseBeneficiaries — cascade UBO (proposition)", () => {
  it("propose des bénéficiaires à partir de lignes avec pourcentage", () => {
    const text = [
      "Bénéficiaires effectifs :",
      "Bénéficiaire effectif : Jean DUPONT — 30 %",
      "Marie-Claire MARTIN détient 25% du capital",
      "Société sans détenteur nommé",
    ].join("\n");
    const r = parseBeneficiaries(text);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nom: "DUPONT", prenoms: "Jean", pourcentage: "30" });
    expect(r[1]).toMatchObject({ nom: "MARTIN", prenoms: "Marie-Claire", pourcentage: "25" });
  });

  it("n'invente rien sans pourcentage lisible", () => {
    expect(parseBeneficiaries("Aucune donnée exploitable ici.")).toEqual([]);
  });

  it("dédoublonne les détenteurs répétés", () => {
    const text = ["Jean DUPONT 30 %", "Jean DUPONT 30 %"].join("\n");
    expect(parseBeneficiaries(text)).toHaveLength(1);
  });

  it("ignore un pourcentage hors bornes", () => {
    expect(parseBeneficiaries("Truc MUCHE 250 %")).toEqual([]);
  });
});
