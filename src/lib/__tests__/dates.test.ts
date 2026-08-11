import { describe, it, expect } from "vitest";
import { parseYearRanges, yearBounds, overlapsWindow } from "../dates";

describe("parseYearRanges — dates explicites", () => {
  it("lit une année simple", () => {
    expect(parseYearRanges("1941")).toEqual([{ min: 1941, max: 1941 }]);
  });
  it("ignore le préfixe « vers / circa / c. »", () => {
    expect(yearBounds("vers 1941")).toEqual({ min: 1941, max: 1941 });
    expect(yearBounds("c. 1870")).toEqual({ min: 1870, max: 1870 });
    expect(yearBounds("circa 1930")).toEqual({ min: 1930, max: 1930 });
  });
  it("lit un intervalle « 1970-1990 »", () => {
    expect(yearBounds("1970-1990")).toEqual({ min: 1970, max: 1990 });
  });
  it("ne confond pas avec un numéro non-année", () => {
    expect(parseYearRanges("lot 42")).toEqual([]);
    expect(parseYearRanges("")).toEqual([]);
  });
});

describe("parseYearRanges — décennies", () => {
  it("« années 40 » → 1940-1949", () => {
    expect(yearBounds("années 40")).toEqual({ min: 1940, max: 1949 });
  });
  it("« années 1930 » → 1930-1939", () => {
    expect(yearBounds("années 1930")).toEqual({ min: 1930, max: 1939 });
  });
  it("tolère les accents et la casse", () => {
    expect(yearBounds("ANNEES 30")).toEqual({ min: 1930, max: 1939 });
  });
});

describe("parseYearRanges — siècles", () => {
  it("« XVIIe siècle » → 1600-1699", () => {
    expect(yearBounds("XVIIe siècle")).toEqual({ min: 1600, max: 1699 });
  });
  it("« 19e siècle » (arabe) → 1800-1899", () => {
    expect(yearBounds("19e siècle")).toEqual({ min: 1800, max: 1899 });
  });
  it("cadrage : « début du XXe siècle » → premier tiers", () => {
    expect(yearBounds("début du XXe siècle")).toEqual({ min: 1900, max: 1933 });
  });
  it("cadrage : « milieu du XXe siècle » → tiers central (touche 1933-1945)", () => {
    expect(yearBounds("milieu du XXe siècle")).toEqual({ min: 1933, max: 1966 });
  });
  it("cadrage : « fin du XIXe siècle » → dernier tiers", () => {
    expect(yearBounds("fin du XIXe siècle")).toEqual({ min: 1866, max: 1899 });
  });
});

describe("overlapsWindow — contrôle spoliation 1933-1945", () => {
  it("détecte le recouvrement via une date floue (pas de faux négatif)", () => {
    expect(overlapsWindow("collection privée, années 40", 1933, 1945)).toBe(true);
    expect(overlapsWindow("milieu du XXe siècle", 1933, 1945)).toBe(true);
    expect(overlapsWindow("acquis vers 1938", 1933, 1945)).toBe(true);
  });
  it("n'invente pas de recouvrement hors fenêtre", () => {
    expect(overlapsWindow("1970-1990", 1933, 1945)).toBe(false);
    expect(overlapsWindow("XIXe siècle", 1933, 1945)).toBe(false);
    expect(overlapsWindow("aucune date", 1933, 1945)).toBe(false);
  });
});
