/*
  Estimateur de force de phrase secrète — PUR, local, sans dépendance.

  On ne fait pas de la « théâtralité de règles » (1 majuscule + 1 chiffre…), qui
  produit des mots de passe faibles ET détestés. On estime l'ENTROPIE réelle et on
  POUSSE la phrase de passe (plusieurs mots), bien plus robuste et mémorisable.

  Repères d'entropie (indicatifs) :
   • < 40 bits  : cassable, à refuser ;
   • 40–60 bits : correct pour un secret local ;
   • > 70 bits  : fort (typiquement 4–5 mots aléatoires).
*/

export interface PassStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0 = très faible … 4 = excellent
  bits: number; // entropie estimée
  label: string;
  hint: string;
  acceptable: boolean; // longueur suffisante, non trivial, score ≥ 2
}

export const PASS_MIN_LEN = 12;

// Échantillon des mots de passe les plus courants (rejet direct).
const COMMON = new Set([
  "password", "motdepasse", "azerty", "azertyuiop", "qwerty", "123456",
  "12345678", "123456789", "1234567890", "000000", "111111", "iloveyou",
  "admin", "welcome", "letmein", "monkey", "dragon", "soleil", "bonjour",
  "changeme", "secret", "abc123", "passw0rd",
]);

const LABELS = ["Très faible", "Faible", "Correct", "Fort", "Excellent"];

function charsetSize(p: string): number {
  let n = 0;
  if (/[a-z]/.test(p)) n += 26;
  if (/[A-Z]/.test(p)) n += 26;
  if (/[0-9]/.test(p)) n += 10;
  if (/[^a-zA-Z0-9]/.test(p)) n += 32; // ponctuation / symboles (approx.)
  return n || 1;
}

/** Nombre de « mots » (séparés par espace, tiret, underscore, point). */
function wordCount(p: string): number {
  return p.split(/[\s\-_.]+/).filter((w) => w.length >= 2).length;
}

/**
 * Estime la force d'une phrase secrète. Combine entropie par jeu de caractères et
 * bonus « phrase de passe » (plusieurs mots), avec pénalités pour trivialité.
 */
export function estimatePassphrase(p: string, minLen = PASS_MIN_LEN): PassStrength {
  const pass = p ?? "";
  const lower = pass.toLowerCase();

  if (!pass) {
    return { score: 0, bits: 0, label: LABELS[0], hint: "Choisissez une phrase de passe (4 mots ou plus).", acceptable: false };
  }
  if (COMMON.has(lower)) {
    return { score: 0, bits: 0, label: LABELS[0], hint: "Mot de passe trop courant — choisissez une phrase de passe.", acceptable: false };
  }

  // Entropie de base : longueur × log2(taille du jeu de caractères).
  let bits = pass.length * Math.log2(charsetSize(pass));

  // Pénalité répétition (« aaaa…», « ababab… ») : réduit l'entropie effective.
  if (/^(.)\1+$/.test(pass) || /^(..)\1+$/.test(pass)) bits *= 0.35;

  // Une vraie phrase de passe (≥ 3 mots) plafonne haut même en minuscules.
  const words = wordCount(pass);
  if (words >= 3) bits = Math.max(bits, 28 + words * 12);

  const score: PassStrength["score"] =
    bits < 28 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;

  const acceptable = pass.length >= minLen && score >= 2 && !COMMON.has(lower);

  const hint = acceptable
    ? words >= 3
      ? "Bonne phrase de passe."
      : "Solide. Une phrase de plusieurs mots serait encore plus mémorisable."
    : pass.length < minLen
      ? `Trop courte : au moins ${minLen} caractères (idéalement 4 mots).`
      : "Trop faible : préférez 4 mots aléatoires (ex. « cerise-tortue-lampe-nord »).";

  return { score, bits: Math.round(bits), label: LABELS[score], hint, acceptable };
}
