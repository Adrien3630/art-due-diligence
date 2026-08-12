"use client";

/*
  Module ŒUVRE (autonome). Due diligence de provenance d'une œuvre : chaîne
  documentée, registres vol/spoliation, authenticité & titre.
*/

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ProgressGauge, RiskBadge, SectionTitle, SubScores } from "@/components/ui";
import { ArtworkForm } from "@/components/ArtworkForm";
import { CompliancePanel } from "@/components/CompliancePanel";
import { assessArtwork } from "@/lib/scoring";
import { artworkCompletion } from "@/lib/completion";
import { buildTrail } from "@/lib/audit";
import { emptyArtwork, newId } from "@/lib/factories";
import { clearDraft, loadDraft, loadHistory, loadSettings } from "@/lib/storage";
import { useAutosave } from "@/lib/useAutosave";
import { takeReopen } from "@/lib/reopen";
import { setWorkbench } from "@/lib/workbench";
import type { Artwork, ArtworkDossier, Settings } from "@/lib/types";

const DRAFT_KEY = "oeuvre";

export default function OeuvrePage() {
  const router = useRouter();
  const [artwork, setArtwork] = useState<Artwork>(
    () => loadDraft<Artwork>(DRAFT_KEY) ?? emptyArtwork(),
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [result, setResult] = useState<ArtworkDossier | null>(null);

  useAutosave(DRAFT_KEY, artwork, !result);

  useEffect(() => {
    setSettings(loadSettings());
    const id = takeReopen();
    if (id) {
      const d = loadHistory().find((x) => x.id === id);
      if (d && d.kind === "oeuvre") {
        setArtwork(d.artwork);
        setResult(d);
      }
    }
  }, []);

  const completion = useMemo(() => artworkCompletion(artwork), [artwork]);
  const canRun = artwork.titre.trim().length > 0 || artwork.artiste.trim().length > 0;

  async function lancer() {
    const assessment = assessArtwork(artwork);
    const auditTrail = await buildTrail([
      {
        type: "dossier_cree",
        detail: `Dossier œuvre créé — ${artwork.titre || artwork.artiste || "sans titre"}`,
      },
      {
        type: "screening_resultat",
        detail: `Vérifications registres consignées · niveau ${assessment.niveau}`,
      },
    ]);
    setResult({
      id: newId(),
      date: new Date().toISOString(),
      kind: "oeuvre",
      artwork,
      assessment,
      auditTrail,
      decision: null,
    });
  }

  function reset() {
    setArtwork(emptyArtwork());
    setResult(null);
    clearDraft(DRAFT_KEY);
  }

  // #4 — envoyer l'œuvre en cours vers le module Transaction, sans re-saisie.
  function versTransaction() {
    setWorkbench({ artwork });
    router.push("/transaction");
  }

  return (
    <div className="mx-auto max-w-4xl px-10 py-10">
      <header className="mb-8">
        <div className="label-eyebrow mb-1">Due diligence — œuvre</div>
        <h1 className="font-serif text-3xl text-ink">Vigilance œuvre</h1>
        <p className="mt-1 text-sm text-muted">
          Provenance, registres d'œuvres volées et spoliées, authenticité. Aucune
          analyse d'image — on documente et on interroge de vraies sources.
        </p>
      </header>

      <Card>
        <ArtworkForm artwork={artwork} onChange={setArtwork} />
        {!result && (
          <div className="mt-6 border-t border-line pt-4">
            <ProgressGauge pct={completion.pct} nextStep={completion.nextStep} />
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={lancer} disabled={!canRun}>
          Lancer la vigilance
        </Button>
        <Button variant="ghost" onClick={versTransaction} disabled={!canRun}>
          Utiliser dans une transaction →
        </Button>
        {!canRun && (
          <span className="text-[0.72rem] text-muted">
            Renseignez au moins le titre ou l'artiste.
          </span>
        )}
      </div>

      {result && settings && (
        <div className="mt-8 animate-rise">
          <Card className="border-line-strong">
            <div className="flex items-start justify-between gap-4">
              <SectionTitle eyebrow={`Dossier œuvre · Réf. ${result.id}`}>
                Synthèse de provenance
              </SectionTitle>
              <RiskBadge niveau={result.assessment.niveau} />
            </div>

            <div className="mb-5">
              <div className="label-eyebrow mb-2">Sous-scores</div>
              <SubScores scores={result.assessment.sousScores} />
            </div>

            <div className="mb-5">
              <div className="label-eyebrow mb-2">Facteurs retenus</div>
              <ul className="space-y-1.5">
                {result.assessment.facteurs.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-gold">—</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-line bg-surface-2 p-3 text-[0.72rem] leading-relaxed text-ink-soft">
              <strong className="font-medium">Décision humaine requise.</strong> Cette
              synthèse ne vaut ni authentification de l'œuvre, ni garantie d'absence
              de revendication. Les vérifications registres reposent sur le constat du
              professionnel.
            </div>

            <CompliancePanel
              dossier={result}
              settings={settings}
              onChange={setResult}
              onReset={reset}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
