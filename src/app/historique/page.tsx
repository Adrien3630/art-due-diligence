"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, RiskBadge } from "@/components/ui";
import { downloadReport } from "@/components/ReportDocument";
import { routeForKind, setReopen } from "@/lib/reopen";
import {
  clearHistory,
  deleteDossier,
  loadHistory,
  loadSettings,
  updateDossier,
} from "@/lib/storage";
import {
  countARevoir,
  dossiersARevoir,
  isVigilanceApplicable,
  rescreenDossier,
  vigilanceDue,
} from "@/lib/monitoring";
import type { Dossier, RiskLevel, Settings } from "@/lib/types";

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
  // La partie affichée dépend du mode (acheteur en vente, vendeur en achat).
  const partie = d.acheteur?.actor ?? d.vendeur?.actor ?? null;
  const nom = partie
    ? partie.kind === "entite"
      ? partie.nom
      : `${partie.prenoms} ${partie.nom}`.trim()
    : "";
  return {
    sujet: `${nom || "—"} · ${d.oeuvre.artwork.titre || "œuvre"}`,
    niveau: d.niveau,
  };
}

export default function HistoriquePage() {
  const router = useRouter();
  const [history, setHistory] = useState<Dossier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = new Date().toISOString();

  function open(d: Dossier) {
    setReopen(d.id);
    router.push(routeForKind(d.kind));
  }

  useEffect(() => {
    setHistory(loadHistory());
    setSettings(loadSettings());
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

  // Re-screening de vigilance continue : recontrôle le dossier, le ré-enregistre
  // et signale tout changement de statut (les listes de sanctions évoluent).
  async function rescreen(d: Dossier) {
    if (!settings) return;
    setBusyId(d.id);
    try {
      const out = await rescreenDossier(d, settings);
      await updateDossier(out.dossier);
      setHistory(loadHistory());
      if (out.changements.length === 0) {
        alert("Re-screening effectué : aucun changement de statut.");
      } else {
        alert(
          `${out.aggrave ? "⚠️ Aggravation détectée" : "Changement détecté"} :\n\n` +
            out.changements.join("\n") +
            (out.aggrave
              ? "\n\nRouvrez le dossier concerné pour traiter l'obligation (gel des avoirs / décision)."
              : ""),
        );
      }
    } catch {
      alert("Re-screening impossible.");
    } finally {
      setBusyId(null);
    }
  }

  const intervalle = settings?.revueIntervalleMois ?? 12;
  // Priorisation : les dossiers à revoir (risque le plus élevé, revue la plus
  // ancienne) remontent en tête ; les autres conservent leur ordre.
  const aRevoir = dossiersARevoir(history, intervalle, now);
  const aRevoirIds = new Set(aRevoir.map((d) => d.id));
  const ordered = [...aRevoir, ...history.filter((d) => !aRevoirIds.has(d.id))];
  const nARevoir = countARevoir(history, intervalle, now);

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

      {nARevoir > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-md border border-risk-mid/40 bg-risk-mid-bg px-4 py-3">
          <span className="text-lg">🔔</span>
          <p className="text-[0.82rem] leading-relaxed text-ink-soft">
            <strong className="font-medium text-risk-mid">
              {nARevoir} dossier{nARevoir > 1 ? "s" : ""} à revoir
            </strong>{" "}
            (revue périodique dépassée, intervalle de {intervalle} mois). Ils sont
            remontés en tête, du plus à risque au plus ancien. Re-screenez-les.
          </p>
        </div>
      )}

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
            {ordered.map((d) => {
              const { sujet, niveau } = summarize(d);
              const due = vigilanceDue(d, intervalle, now);
              const applicable = isVigilanceApplicable(d);
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
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-ink">{sujet}</span>
                    {due && (
                      <span className="shrink-0 rounded-full bg-risk-mid-bg px-2 py-0.5 text-[0.6rem] font-medium text-risk-mid">
                        À revoir
                      </span>
                    )}
                    {d.aFinaliser && (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6rem] font-medium text-muted">
                        À finaliser
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3 justify-self-end">
                    <RiskBadge niveau={niveau} size="sm" />
                    <button
                      onClick={() => open(d)}
                      className="text-[0.72rem] font-medium text-gold underline-offset-2 hover:underline"
                    >
                      Ouvrir
                    </button>
                    {applicable && (
                      <button
                        onClick={() => rescreen(d)}
                        disabled={busyId === d.id}
                        className="text-[0.72rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline disabled:opacity-40"
                      >
                        {busyId === d.id ? "…" : "Re-screener"}
                      </button>
                    )}
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
