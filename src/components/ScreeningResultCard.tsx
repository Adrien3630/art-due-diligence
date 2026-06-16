"use client";

/*
  Affiche un résultat de screening (acteur ou bénéficiaire effectif).
  Si `onMatchesChange` est fourni, chaque correspondance peut être écartée comme
  FAUX POSITIF (avec justification) : elle sort alors du calcul de risque mais
  reste affichée (barrée) et tracée au journal d'audit. Sinon : lecture seule.
*/

import { STATUS_PILL } from "@/components/ui";
import type { ScreeningMatch, ScreeningResult } from "@/lib/types";

export function ScreeningResultCard({
  titre,
  r,
  onMatchesChange,
}: {
  titre: string;
  r: ScreeningResult;
  onMatchesChange?: (matches: ScreeningMatch[], audited: boolean) => void;
}) {
  const pill = STATUS_PILL[r.status];
  const interactive = !!onMatchesChange;

  function toggle(i: number) {
    onMatchesChange?.(
      r.matches.map((m, j) => (j === i ? { ...m, ecarte: !m.ecarte } : m)),
      true,
    );
  }
  function setJustif(i: number, text: string) {
    onMatchesChange?.(
      r.matches.map((m, j) => (j === i ? { ...m, justificationEcart: text } : m)),
      false,
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface-2 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label-eyebrow">{titre}</span>
        <span
          className="rounded-full px-2.5 py-1 text-[0.7rem] font-medium"
          style={{ color: pill.color, background: pill.bg }}
        >
          {pill.label}
        </span>
      </div>
      {r.message && (
        <p className="text-[0.72rem] leading-relaxed text-muted">{r.message}</p>
      )}
      {r.matches.length > 0 && (
        <ul className="mt-2 space-y-2">
          {r.matches.map((m, i) => (
            <li key={i} className="text-[0.74rem]">
              <div className="flex items-start justify-between gap-2">
                <span className={m.ecarte ? "text-muted line-through" : "text-ink-soft"}>
                  <span className="font-medium">{m.nom}</span> — {m.type} ({m.score})
                  {m.listes.length > 0 && (
                    <span className="text-muted"> · {m.listes.join(", ")}</span>
                  )}
                </span>
                {interactive && (
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="shrink-0 text-[0.68rem] underline-offset-2 hover:underline"
                    style={{ color: m.ecarte ? "var(--color-gold)" : "var(--color-muted)" }}
                  >
                    {m.ecarte ? "Rétablir" : "Écarter (faux positif)"}
                  </button>
                )}
              </div>
              {interactive && m.ecarte && (
                <input
                  className="input-line mt-1 text-[0.72rem]"
                  value={m.justificationEcart ?? ""}
                  onChange={(e) => setJustif(i, e.target.value)}
                  placeholder="Justification (homonyme, date de naissance différente…)"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {r.status === "clear" && (
        <p className="mt-1 text-[0.72rem] text-muted">
          {r.listesInterrogees.length
            ? `Listes testées : ${r.listesInterrogees.join(", ")}`
            : "Aucune correspondance retenue sur les listes interrogées."}
          {r.desambiguise && " · recherche désambiguïsée"}
        </p>
      )}
    </div>
  );
}
