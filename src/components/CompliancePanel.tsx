"use client";

/*
  Boucle de conformité (commune aux trois modules) :
   • capture de la décision humaine ;
   • si soupçon ou risque élevé → projet de déclaration Tracfin ;
   • journal d'audit chaîné ;
   • export PDF + archivage (conditionné à une décision saisie).
  Générique sur le type de Dossier ; n'opère que sur les champs communs.
*/

import { useMemo, useState } from "react";
import { Button, SectionTitle } from "@/components/ui";
import { DecisionPanel, DECISION_LABEL } from "@/components/DecisionPanel";
import { AuditTimeline } from "@/components/AuditTimeline";
import { downloadReport } from "@/components/ReportDocument";
import { appendEvent } from "@/lib/audit";
import { buildTracfinDraft, downloadTracfin } from "@/lib/tracfin";
import { saveDossier } from "@/lib/storage";
import type { Dossier, HumanDecision, RiskLevel, Settings } from "@/lib/types";

function dossierNiveau(d: Dossier): RiskLevel {
  if (d.kind === "acteur") return d.assessment.niveau;
  if (d.kind === "oeuvre") return d.assessment.niveau;
  return d.niveau;
}

export function CompliancePanel<D extends Dossier>({
  dossier,
  settings,
  onChange,
  onReset,
}: {
  dossier: D;
  settings: Settings;
  onChange: (d: D) => void;
  onReset: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [showTracfin, setShowTracfin] = useState(false);
  const [copied, setCopied] = useState(false);

  const niveau = dossierNiveau(dossier);
  const isDeclaration = dossier.decision?.type === "declaration";
  const tracfinPertinent = isDeclaration || niveau === "eleve";
  const draft = useMemo(
    () => buildTracfinDraft(dossier, settings),
    [dossier, settings],
  );

  async function onDecision(decision: HumanDecision) {
    const trail = await appendEvent(
      dossier.auditTrail,
      "decision_saisie",
      `Décision : ${DECISION_LABEL[decision.type]} — ${decision.signataire || "non signé"}`,
    );
    setSaved(false);
    onChange({ ...dossier, decision, auditTrail: trail } as D);
  }

  async function archive() {
    const trail = await appendEvent(
      dossier.auditTrail,
      "dossier_archive",
      "Dossier archivé dans l'historique local",
    );
    const finalDossier = { ...dossier, auditTrail: trail } as D;
    try {
      await saveDossier(finalDossier);
      onChange(finalDossier);
      setSaved(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de l'archivage.");
    }
  }

  async function copyTracfin() {
    try {
      await navigator.clipboard.writeText(`${draft.objet}\n\n${draft.corps}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const canArchive = dossier.decision != null && !saved;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <SectionTitle eyebrow="Clôture">Décision & conformité</SectionTitle>

      <DecisionPanel
        decision={dossier.decision}
        signataireDefaut={settings.signataire}
        onSave={onDecision}
      />

      {tracfinPertinent && (
        <div className="mt-4 rounded-md border border-risk-high/30 bg-risk-high-bg/40 p-4">
          <p className="mb-2 text-[0.78rem] text-ink-soft">
            <strong className="font-medium text-risk-high">Soupçon / risque élevé.</strong>{" "}
            Vous pouvez préparer un projet de déclaration de soupçon (Tracfin).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setShowTracfin((v) => !v)}>
              {showTracfin ? "Masquer le projet" : "Générer le projet de déclaration"}
            </Button>
            {showTracfin && (
              <>
                <button
                  onClick={copyTracfin}
                  className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
                >
                  {copied ? "✓ Copié" : "Copier"}
                </button>
                <button
                  onClick={() => downloadTracfin(draft, dossier)}
                  className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
                >
                  Télécharger (.txt)
                </button>
              </>
            )}
          </div>
          {showTracfin && (
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 font-sans text-[0.74rem] leading-relaxed text-ink-soft">
              {draft.corps}
            </pre>
          )}
        </div>
      )}

      <div className="mt-5">
        <AuditTimeline trail={dossier.auditTrail} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => downloadReport(dossier)}>
          Exporter le dossier (PDF)
        </Button>
        <Button variant="ghost" onClick={archive} disabled={!canArchive}>
          {saved ? "✓ Dossier archivé" : "Archiver le dossier"}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Nouveau dossier
        </Button>
        {!dossier.decision && (
          <span className="text-[0.72rem] text-muted">
            Saisissez une décision pour pouvoir archiver.
          </span>
        )}
      </div>
    </div>
  );
}
