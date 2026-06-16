"use client";

import { useEffect, useState } from "react";
import { Button, Card, RiskBadge } from "@/components/ui";
import { downloadReport } from "@/components/ReportDocument";
import { clearHistory, deleteDossier, loadHistory } from "@/lib/storage";
import type { Dossier, RiskLevel } from "@/lib/types";

const KIND_LABEL: Record<Dossier["kind"], string> = {
  acteur: "Acteur",
  oeuvre: "Œuvre",
  transaction: "Transaction",
};

/** Résume un dossier (quel que soit son type) pour le tableau. */
function summarize(d: Dossier): { sujet: string; niveau: RiskLevel } {
  if (d.kind === "acteur") {
    const a = d.actor;
    const nom = a.kind === "entite" ? a.nom : `${a.prenoms} ${a.nom}`.trim();
    return { sujet: nom || "—", niveau: d.assessment.niveau };
  }
  if (d.kind === "oeuvre") {
    const sujet =
      d.artwork.titre || d.artwork.artiste
        ? `${d.artwork.titre}${d.artwork.artiste ? ` · ${d.artwork.artiste}` : ""}`
        : "—";
    return { sujet, niveau: d.assessment.niveau };
  }
  const a = d.acheteur.actor;
  const ach = a.kind === "entite" ? a.nom : `${a.prenoms} ${a.nom}`.trim();
  return {
    sujet: `${ach || "—"} · ${d.oeuvre.artwork.titre || "œuvre"}`,
    niveau: d.niveau,
  };
}

export default function HistoriquePage() {
  const [history, setHistory] = useState<Dossier[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  async function remove(id: string) {
    await deleteDossier(id);
    setHistory(loadHistory());
  }

  async function wipe() {
    if (!confirm("Effacer définitivement tout l'historique local ?")) return;
    await clearHistory();
    setHistory([]);
  }

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Dossiers clôturés</div>
          <h1 className="font-serif text-3xl text-ink">Historique Local</h1>
          <p className="mt-1 text-sm text-muted">
            Conservé uniquement sur cet ordinateur. Rien n'est synchronisé.
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" onClick={wipe}>
            Tout effacer
          </Button>
        )}
      </header>

      {history.length === 0 ? (
        <Card className="text-center">
          <div className="py-10">
            <div className="font-serif text-4xl text-line-strong">∅</div>
            <p className="mt-4 text-sm text-ink-soft">
              Aucun dossier archivé pour l'instant.
            </p>
            <p className="mt-1 text-[0.72rem] text-muted">
              Les dossiers que vous archivez depuis les écrans d'analyse
              apparaîtront ici.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="grid grid-cols-[0.7fr_1fr_1.6fr_auto] gap-4 border-b border-line px-6 py-3">
            {["Type", "Date", "Sujet", "Risque"].map((h) => (
              <span key={h} className="label-eyebrow">
                {h}
              </span>
            ))}
          </div>
          <ul>
            {history.map((d) => {
              const { sujet, niveau } = summarize(d);
              return (
                <li
                  key={d.id}
                  className="grid grid-cols-[0.7fr_1fr_1.6fr_auto] items-center gap-4 border-b border-line px-6 py-4 last:border-0 hover:bg-surface-2"
                >
                  <span className="text-[0.72rem] font-medium uppercase tracking-wide text-gold">
                    {KIND_LABEL[d.kind]}
                  </span>
                  <span className="text-[0.8rem] text-ink-soft">
                    {new Date(d.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="truncate text-sm text-ink">{sujet}</span>
                  <div className="flex items-center gap-3 justify-self-end">
                    <RiskBadge niveau={niveau} size="sm" />
                    <button
                      onClick={() => downloadReport(d)}
                      className="text-[0.72rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="text-[0.72rem] text-muted underline-offset-2 hover:text-risk-high hover:underline"
                    >
                      Suppr.
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
