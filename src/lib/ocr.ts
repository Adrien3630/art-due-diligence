/*
  OCR local ASSISTÉ des pièces (CNI, passeport, Kbis).

  Principe : l'OCR tourne 100 % dans le navigateur (tesseract.js / WebAssembly).
  L'image de la pièce NE QUITTE JAMAIS la machine ; seuls les fichiers statiques
  du moteur (wasm + données de langue) sont téléchargés depuis un CDN au premier
  usage. Le résultat est une PROPOSITION de champs : rien n'est appliqué sans
  validation humaine (cf. UI). Les parseurs ci-dessous sont PURS et testés ;
  l'appel au moteur est isolé dans `runOcr`.
*/

export interface IdentityCandidates {
  nom?: string;
  prenoms?: string;
  dateNaissance?: string; // ISO YYYY-MM-DD
  nationalite?: string;
}

export interface EntityCandidates {
  nom?: string;
  immatriculation?: string; // SIREN (9 chiffres)
}

/** Un bénéficiaire effectif PROPOSÉ à partir d'un document sociétaire. */
export interface BeneficiaryCandidate {
  nom: string;
  prenoms: string;
  pourcentage: string; // part détectée, sans le « % »
}

/* ── Normalisation de dates ─────────────────────────────────────────── */

/** « 12.05.1980 » / « 12/05/80 » / « 12 05 1980 » → « 1980-05-12 ». */
export function toIsoDate(raw: string, now = new Date()): string | undefined {
  const m = raw.match(/\b([0-3]?\d)[./ -]([0-1]?\d)[./ -](\d{2,4})\b/);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (m[3].length === 2) {
    // Année sur 2 chiffres : bascule de siècle prudente (date de naissance).
    const pivot = now.getFullYear() % 100;
    y = y > pivot ? 1900 + y : 2000 + y;
  }
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > now.getFullYear()) {
    return undefined;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ── Parsing zone MRZ (passeport TD3 / CNI) ─────────────────────────── */

/**
 * Tente de lire une zone MRZ (lignes de `<` et majuscules). Source la plus
 * fiable quand elle est correctement océrisée. Renvoie `null` si absente.
 */
export function parseMrz(text: string, now = new Date()): IdentityCandidates | null {
  const lines = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => /^[A-Z0-9<]{20,}$/.test(l) && l.includes("<"));
  if (!lines.length) return null;

  const out: IdentityCandidates = {};

  // Ligne « nom » : P<FRADUPONT<<JEAN<PAUL<<...  ou  IDFRADUPONT<<JEAN<<...
  const nameLine = lines.find((l) => /^[A-Z]{1,2}<[A-Z]{3}/.test(l) || l.includes("<<"));
  if (nameLine) {
    const body = nameLine.replace(/^[A-Z]{1,2}</, "").replace(/^[A-Z]{3}/, "");
    const [surname, given] = body.split("<<");
    if (surname) out.nom = surname.replace(/</g, " ").trim();
    if (given) out.prenoms = given.replace(/</g, " ").trim();
    const country = nameLine.match(/^[A-Z]{1,2}<([A-Z]{3})/)?.[1];
    if (country === "FRA") out.nationalite = "Française";
  }

  // Date de naissance : dans une ligne « données », 6 chiffres YYMMDD.
  const dataLine = lines.find((l) => /\d{6}/.test(l) && l !== nameLine);
  const yymmdd = dataLine?.match(/(\d{6})/)?.[1];
  if (yymmdd) {
    const iso = toIsoDate(
      `${yymmdd.slice(4, 6)}.${yymmdd.slice(2, 4)}.${yymmdd.slice(0, 2)}`,
      now,
    );
    if (iso) out.dateNaissance = iso;
  }

  return Object.keys(out).length ? out : null;
}

/* ── Parsing texte étiqueté (fallback hors MRZ) ─────────────────────── */

function firstMatch(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1]?.trim() || undefined;
}

/** Extrait des champs d'identité d'un texte OCR (MRZ prioritaire). */
export function parseIdentityText(text: string, now = new Date()): IdentityCandidates {
  const mrz = parseMrz(text, now);
  const out: IdentityCandidates = { ...(mrz ?? {}) };

  if (!out.nom) {
    // « Nom : DUPONT » (patronyme en majuscules), sans matcher « Prénoms ».
    out.nom = firstMatch(text, /\b[Nn]om\b\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ'’ -]{1,40})/);
  }
  if (!out.prenoms) {
    out.prenoms = firstMatch(text, /[Pp]r[ée]noms?\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ -]{1,40})/);
  }
  if (!out.dateNaissance) {
    const near = firstMatch(
      text,
      /[Nn][ée]\(?e?\)?\s*(?:le)?\s*[:\-]?\s*([0-3]?\d[./ -][0-1]?\d[./ -]\d{2,4})/,
    );
    if (near) out.dateNaissance = toIsoDate(near, now);
  }
  if (!out.nationalite) {
    const nat = firstMatch(text, /[Nn]ationalit[ée]\s*[:\-]?\s*([A-Za-zÀ-ÿ]{3,20})/);
    if (nat) out.nationalite = nat.charAt(0).toUpperCase() + nat.slice(1).toLowerCase();
  }
  // Nettoyage : retire les valeurs vides.
  (Object.keys(out) as (keyof IdentityCandidates)[]).forEach((k) => {
    if (!out[k]) delete out[k];
  });
  return out;
}

/** Extrait des champs d'entité d'un texte OCR (Kbis / extrait). */
export function parseEntityText(text: string): EntityCandidates {
  const out: EntityCandidates = {};
  const siren = text.match(/\b(\d{3}[  ]?\d{3}[  ]?\d{3})\b/)?.[1];
  if (siren) out.immatriculation = siren.replace(/\s/g, "");
  const denom =
    firstMatch(text, /d[ée]nomination\s*(?:sociale)?\s*[:\-]?\s*(.+)/i) ||
    firstMatch(text, /raison\s+sociale\s*[:\-]?\s*(.+)/i);
  if (denom) out.nom = denom.replace(/\s{2,}.*$/, "").trim();
  return out;
}

/* ── Cascade de bénéficiaires effectifs (UBO) — PROPOSITION ─────────── */

// Étiquettes fréquentes à retirer avant d'isoler un nom de personne.
const UBO_LABELS =
  /b[ée]n[ée]ficiaire(?:\s+effectif)?|d[ée]tenteur|associ[ée]|g[ée]rant|pr[ée]sident|d[ée]tient|d[ée]tenant|part\s+de|du\s+capital|des?\s+parts?|droits?\s+de\s+vote/gi;

/** Sépare « Jean DUPONT » → nom = patronyme (majuscules), prénoms = le reste. */
function splitPersonName(raw: string): { nom: string; prenoms: string } {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const caps = tokens.filter((t) => t.length > 1 && t === t.toUpperCase());
  if (caps.length && caps.length < tokens.length) {
    const nom = caps.join(" ");
    const prenoms = tokens.filter((t) => !caps.includes(t)).join(" ");
    return { nom, prenoms };
  }
  // Pas de distinction de casse : dernier mot = nom, le reste = prénoms.
  if (tokens.length >= 2) {
    return { nom: tokens[tokens.length - 1], prenoms: tokens.slice(0, -1).join(" ") };
  }
  return { nom: raw.trim(), prenoms: "" };
}

/**
 * Reconstruit une CASCADE de bénéficiaires à partir du texte océrisé d'un
 * document sociétaire (Kbis, statuts, déclaration DBE). Repère les lignes
 * portant un pourcentage de détention et en extrait un nom.
 *
 * HONNÊTETÉ : ce n'est qu'une PROPOSITION à valider — l'humain contrôle chaque
 * nœud (et corrige personne/entité) avant tout screening. On n'invente pas de
 * détenteur : sans pourcentage lisible, on ne propose rien.
 */
export function parseBeneficiaries(text: string): BeneficiaryCandidate[] {
  const out: BeneficiaryCandidate[] = [];
  const pct = /(\d{1,3}(?:[.,]\d+)?)\s*(?:%|pour\s*cent)/i;

  for (const line of text.split(/\r?\n/)) {
    const pm = line.match(pct);
    if (!pm) continue;
    const share = Number(pm[1].replace(",", "."));
    if (!Number.isFinite(share) || share <= 0 || share > 100) continue;

    // Retire le pourcentage et les étiquettes, garde la portion « nom ».
    const cleaned = line
      .replace(pct, " ")
      .replace(UBO_LABELS, " ")
      .replace(/[.,;:()«»"]/g, " ");
    const nameMatch = cleaned.match(
      /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+){0,3})/,
    );
    if (!nameMatch) continue;
    const { nom, prenoms } = splitPersonName(nameMatch[1].trim());
    if (!nom || nom.length < 2) continue;
    out.push({ nom, prenoms, pourcentage: pm[1].replace(",", ".") });
  }

  // Dédoublonnage par (nom, prénoms).
  const seen = new Set<string>();
  return out.filter((b) => {
    const k = `${b.nom}|${b.prenoms}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ── Moteur OCR (isolé, client-only) ────────────────────────────────── */

/**
 * Océrise une image (data-URL) en français, dans le navigateur. Import
 * dynamique pour éviter tout chargement côté serveur (SSR). Renvoie le texte
 * brut ; le parsing est fait par les fonctions pures ci-dessus.
 */
export async function runOcr(dataUrl: string): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(dataUrl, "fra");
  return data.text ?? "";
}
