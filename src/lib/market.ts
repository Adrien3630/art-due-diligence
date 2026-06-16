/*
  Couche d'accès aux DONNÉES DE MARCHÉ (cote / comparables d'enchères), côté client.

  Même philosophie que le screening :
   • En web : appelle la route Next /api/market.
   • Sans fournisseur configuré → mode démonstration explicitement NON probant.
   • En cas d'échec → statut `error`, jamais une fourchette inventée.
   • En Tauri : remplacer le corps de `runMarketCheck` par un invoke() Rust,
     contrat d'E/S identique.

  HONNÊTETÉ : on n'auto-décide JAMAIS qu'un prix est frauduleux. On rapporte des
  comparables réels (s'il y en a) et on SUGGÈRE à l'humain de cocher l'indicateur
  GAFI « prix incohérent ». L'humain reste seul juge.
*/

import type {
  MarketResult,
  PriceCoherence,
  Settings,
} from "./types";

export type MarketCred = Pick<
  Settings,
  "marcheFournisseur" | "marcheApiKey" | "marcheEndpoint"
>;

export async function runMarketCheck(
  artiste: string,
  cred: MarketCred,
): Promise<MarketResult> {
  try {
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artiste, settings: cred }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as MarketResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return {
      artiste,
      status: "error",
      comparables: [],
      fourchetteEur: null,
      fournisseur: cred.marcheFournisseur,
      horodatage: new Date().toISOString(),
      message: `Interrogation du marché impossible : ${message}`,
    };
  }
}

/**
 * Cohérence d'un prix de transaction vis-à-vis de la fourchette observée.
 * Fonction PURE (testable) — n'interroge rien, ne décide rien : informe.
 *
 * Règles transparentes (indicatives, à valider par un juriste) :
 *  • prix dans [min, max]                → cohérent
 *  • prix > 1.5 × max                    → anormalement élevé  → drapeau suggéré
 *  • prix < 0.5 × min                    → anormalement bas    → drapeau suggéré
 *  • entre les deux (hors fourchette mais proche) → cohérent (tolérance de marché)
 *  • données insuffisantes / pas de prix → indéterminé (aucune suggestion)
 */
export function assessPriceCoherence(
  montantEur: number | null,
  result: Pick<MarketResult, "status" | "fourchetteEur"> | null,
): PriceCoherence {
  if (montantEur == null || montantEur <= 0) {
    return {
      verdict: "indetermine",
      message: "Aucun montant de transaction renseigné — cohérence non évaluée.",
      suggereDrapeau: false,
    };
  }
  if (!result || result.status !== "ok" || !result.fourchetteEur) {
    return {
      verdict: "indetermine",
      message:
        "Pas de comparables de marché probants — cohérence du prix à apprécier manuellement.",
      suggereDrapeau: false,
    };
  }

  const { min, max, mediane } = result.fourchetteEur;
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
  const ref = `fourchette observée ${fmt(min)}–${fmt(max)} (médiane ${fmt(mediane)})`;

  if (montantEur > max * 1.5) {
    return {
      verdict: "eleve",
      message: `Prix (${fmt(montantEur)}) nettement au-dessus du marché — ${ref}.`,
      suggereDrapeau: true,
    };
  }
  if (montantEur < min * 0.5) {
    return {
      verdict: "bas",
      message: `Prix (${fmt(montantEur)}) nettement en-dessous du marché — ${ref}.`,
      suggereDrapeau: true,
    };
  }
  return {
    verdict: "coherent",
    message: `Prix (${fmt(montantEur)}) cohérent avec le marché — ${ref}.`,
    suggereDrapeau: false,
  };
}

export const MARKET_STATUS_LABEL: Record<MarketResult["status"], string> = {
  ok: "Comparables obtenus",
  insufficient: "Données insuffisantes",
  demo: "Mode démonstration (non probant)",
  error: "Interrogation impossible",
};
