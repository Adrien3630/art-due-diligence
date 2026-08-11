"use client";

/*
  Vérification de la COTE d'un artiste (comparables d'enchères).

  Honnêteté : sans fournisseur configuré, le résultat est étiqueté « non probant »
  (mode démonstration). L'outil ne décide JAMAIS qu'un prix est frauduleux : il
  affiche les comparables, calcule une cohérence indicative, et SUGGÈRE à l'humain
  de cocher l'indicateur GAFI « prix incohérent ». L'humain coche lui-même.
*/

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  assessPriceCoherence,
  MARKET_STATUS_LABEL,
  runMarketCheck,
  type MarketCred,
} from "@/lib/market";
import { loadSettings } from "@/lib/storage";
import type { MarketResult } from "@/lib/types";

const VERDICT_TONE: Record<string, string> = {
  coherent: "text-risk-low",
  eleve: "text-risk-high",
  bas: "text-risk-high",
  indetermine: "text-muted",
};

export function MarketPanel({
  artiste,
  montantEur,
  onFlagPrix,
}: {
  artiste: string;
  montantEur?: number | null;
  // Présent en contexte transaction (un prix existe) : permet de reporter le
  // signal dans l'indicateur GAFI « prix incohérent ».
  onFlagPrix?: () => void;
}) {
  const [cred, setCred] = useState<MarketCred | null>(null);
  const [result, setResult] = useState<MarketResult | null>(null);
  const [running, setRunning] = useState(false);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setCred({
      marcheFournisseur: s.marcheFournisseur,
      marcheApiKey: s.marcheApiKey,
      marcheEndpoint: s.marcheEndpoint,
    });
  }, []);

  const configure = cred && cred.marcheFournisseur !== "aucun" && !!cred.marcheApiKey;
  const coherence = assessPriceCoherence(montantEur ?? null, result);
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

  async function verifier() {
    if (!cred || !artiste.trim()) return;
    setRunning(true);
    setResult(null);
    setFlagged(false);
    setResult(await runMarketCheck(artiste.trim(), cred));
    setRunning(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.72rem] leading-relaxed text-muted">
          Comparables d'enchères pour objectiver l'indicateur « prix incohérent ».
          {!configure && " Aucun fournisseur configuré → résultat de démonstration, non probant."}
        </p>
        <Button variant="ghost" onClick={verifier} disabled={!artiste.trim() || running}>
          {running ? "Interrogation…" : "Vérifier la cote"}
        </Button>
      </div>

      {result && (
        <div className="mt-3 rounded-md border border-line bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[0.74rem] text-ink-soft">
              {result.fournisseur} · {MARKET_STATUS_LABEL[result.status]}
            </span>
            {result.fourchetteEur && (
              <span className="text-[0.74rem] text-ink">
                Fourchette {fmt(result.fourchetteEur.min)}–{fmt(result.fourchetteEur.max)} · médiane{" "}
                {fmt(result.fourchetteEur.mediane)}
              </span>
            )}
          </div>

          {result.message && (
            <p className="mb-2 text-[0.7rem] leading-relaxed text-muted">{result.message}</p>
          )}

          {result.comparables.length > 0 && (
            <ul className="mb-2 space-y-1">
              {result.comparables.map((c, i) => (
                <li key={i} className="flex justify-between gap-3 text-[0.72rem] text-ink-soft">
                  <span className="min-w-0 truncate">
                    {c.titre} · {c.maison} · {c.date}
                  </span>
                  <span className="shrink-0">{fmt(c.prixEur)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Verdict de cohérence (uniquement si un montant existe). */}
          {montantEur != null && montantEur > 0 && (
            <div className="mt-2 border-t border-line pt-2">
              <p className={`text-[0.74rem] ${VERDICT_TONE[coherence.verdict]}`}>
                {coherence.message}
              </p>
              {coherence.suggereDrapeau && onFlagPrix && (
                <button
                  type="button"
                  disabled={flagged}
                  onClick={() => {
                    onFlagPrix();
                    setFlagged(true);
                  }}
                  className="mt-1.5 text-[0.72rem] text-gold underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
                >
                  {flagged
                    ? "✓ Indicateur « prix incohérent » coché"
                    : "Cocher l'indicateur GAFI « prix incohérent » →"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
