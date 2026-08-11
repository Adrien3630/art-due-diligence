/*
  Interprétation de dates historiques en texte libre.

  Remplace l'extraction d'années « brute » (regex 4 chiffres) par une lecture
  tolérante aux formulations floues courantes en provenance d'œuvres :
   • années explicites .................. « 1941 », « vers 1941 », « c. 1941 »
   • décennies .......................... « années 40 », « années 1930 »
   • siècles (romains ou arabes) ........ « XVIIe siècle », « 19e siècle »
   • cadrage dans le siècle ............. « début / milieu / fin du XXe siècle »

  But de conformité : ne PAS rater le trou 1933-1945 (spoliation) ni les
  ruptures de provenance à cause d'une date exprimée en clair non numérique.
  Toute plage floue est traitée de façon PRUDENTE (fenêtre large), pour
  déclencher la vigilance plutôt que l'écarter à tort.

  Honnêteté : ce n'est PAS un moteur NLP. C'est un jeu de règles explicites et
  testées ; une date non reconnue renvoie simplement « aucune borne ».
*/

/** Une borne temporelle [min, max] (années pleines, inclusives). */
export interface YearRange {
  min: number;
  max: number;
}

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18,
  xix: 19, xx: 20, xxi: 21,
};

/** Normalise (sans accents, minuscules, espaces compactés). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bornes d'un siècle n (n=20 → 1900-1999), éventuellement cadrées. */
function centuryRange(n: number, part: "debut" | "milieu" | "fin" | null): YearRange {
  const base = (n - 1) * 100; // XXe → 1900
  if (part === "debut") return { min: base, max: base + 33 };
  if (part === "milieu") return { min: base + 33, max: base + 66 };
  if (part === "fin") return { min: base + 66, max: base + 99 };
  return { min: base, max: base + 99 };
}

function detectPart(prefix: string): "debut" | "milieu" | "fin" | null {
  if (/\b(debut|commencement|premiere moitie|premier tiers)\b/.test(prefix)) return "debut";
  if (/\b(milieu|mi|deuxieme tiers|seconde moitie|mi-)\b/.test(prefix)) return "milieu";
  if (/\b(fin|derniere moitie|dernier tiers)\b/.test(prefix)) return "fin";
  return null;
}

/**
 * Toutes les bornes temporelles décelées dans un texte (éventuellement plusieurs).
 * Chaque forme reconnue produit une plage ; les plages ne sont pas fusionnées.
 */
export function parseYearRanges(text: string): YearRange[] {
  if (!text) return [];
  const s = norm(text);
  const ranges: YearRange[] = [];

  // 1) Décennies : « années 40 », « années 1930 ». Traité AVANT les années
  //    explicites pour éviter que « années 30 » soit ignoré (pas de 4 chiffres).
  const decadeRe = /ann[e]es\s+(\d{2}|\d{4})\b/g;
  const consumed: Array<[number, number]> = []; // spans à ne pas relire en années brutes
  for (let m; (m = decadeRe.exec(s)); ) {
    const raw = m[1];
    const dec = raw.length === 2 ? 1900 + Number(raw) : Number(raw);
    const decadeStart = Math.floor(dec / 10) * 10;
    ranges.push({ min: decadeStart, max: decadeStart + 9 });
    consumed.push([m.index, m.index + m[0].length]);
  }

  // 2) Siècles romains ou arabes, avec cadrage éventuel dans les ~40 caractères
  //    qui précèdent (« début du », « milieu du », « fin du »).
  const centuryRe =
    /\b([ivx]+|\d{1,2})\s*(?:e|er|eme|ere)?\s*siecle\b/g;
  for (let m; (m = centuryRe.exec(s)); ) {
    const token = m[1];
    const n = /^\d+$/.test(token) ? Number(token) : ROMAN[token];
    if (!n || n < 1 || n > 21) continue;
    const prefix = s.slice(Math.max(0, m.index - 40), m.index);
    ranges.push(centuryRange(n, detectPart(prefix)));
    consumed.push([m.index, m.index + m[0].length]);
  }

  // 3) Années explicites 1500-2099 (hors spans déjà consommés par 1 et 2).
  const yearRe = /\b(1[5-9]\d{2}|20\d{2})\b/g;
  for (let m; (m = yearRe.exec(s)); ) {
    const inside = consumed.some(([a, b]) => m!.index >= a && m!.index < b);
    if (inside) continue;
    const y = Number(m[1]);
    ranges.push({ min: y, max: y });
  }

  return ranges;
}

/**
 * Bornes agrégées d'un texte : [plus petite année plausible, plus grande].
 * `null` si aucune date reconnue. Sert aux contrôles de recouvrement et de
 * rupture, qui raisonnent sur un intervalle global.
 */
export function yearBounds(text: string): YearRange | null {
  const ranges = parseYearRanges(text);
  if (!ranges.length) return null;
  return {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
  };
}

/**
 * Le texte recouvre-t-il (même partiellement) la fenêtre [from, to] ?
 * Prudent : une plage floue qui touche la fenêtre compte comme un recouvrement.
 */
export function overlapsWindow(text: string, from: number, to: number): boolean {
  return parseYearRanges(text).some((r) => r.min <= to && r.max >= from);
}
