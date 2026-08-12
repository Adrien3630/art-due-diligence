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
import { Button, InlineAlert, SectionTitle } from "@/components/ui";
import { DecisionPanel, DECISION_LABEL } from "@/components/DecisionPanel";
import { AuditTimeline } from "@/components/AuditTimeline";
import { ReportPreviewModal } from "@/components/ReportDocument";
import { appendEvent } from "@/lib/audit";
import { buildTracfinDraft, downloadTracfin } from "@/lib/tracfin";
import {
  buildFreezeNotice,
  downloadFreezeNotice,
  hasFreezeObligation,
  DGTRESOR_EMAIL,
  REGISTRE_GELS_URL,
} from "@/lib/freeze";
import { attestationDetail, registerReview } from "@/lib/registers";
import { isTimestampingEnabled, requestTimestamp } from "@/lib/timestamp";
import { upsertDossier } from "@/lib/storage";
import { PENAL_RESPONSIBILITY_NOTICE } from "@/lib/scoring";
import type { Dossier, HumanDecision, RegisterCheck, RiskLevel, Settings } from "@/lib/types";

function dossierNiveau(d: Dossier): RiskLevel {
  if (d.kind === "acteur") return d.assessment.niveau;
  if (d.kind === "oeuvre") return d.assessment.niveau;
  return d.niveau;
}

/** Registres portés par le dossier (œuvre seule ou œuvre d'une transaction). */
function dossierRegistres(d: Dossier): RegisterCheck[] {
  if (d.kind === "oeuvre") return d.artwork.registres;
  if (d.kind === "transaction") return d.oeuvre.artwork.registres;
  return [];
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
  const [showFreeze, setShowFreeze] = useState(false);
  const [freezeCopied, setFreezeCopied] = useState(false);
  const [freezeLogged, setFreezeLogged] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [stamping, setStamping] = useState(false);

  const registres = dossierRegistres(dossier);
  const revue = registerReview(registres);
  const dejaAtteste = dossier.auditTrail.some((e) => e.type === "registres_attestes");
  const horodatageActif = isTimestampingEnabled(settings);

  const niveau = dossierNiveau(dossier);
  const isDeclaration = dossier.decision?.type === "declaration";
  const tracfinPertinent = isDeclaration || niveau === "eleve";
  const draft = useMemo(
    () => buildTracfinDraft(dossier, settings),
    [dossier, settings],
  );

  // Gel des avoirs : obligation distincte, déclenchée par une correspondance
  // de sanction (faux positifs écartés exclus).
  const freezeObligation = hasFreezeObligation(dossier);
  const freezeNotice = useMemo(
    () => buildFreezeNotice(dossier, settings),
    [dossier, settings],
  );

  async function revealFreeze() {
    const next = !showFreeze;
    setShowFreeze(next);
    if (next && !freezeLogged) {
      setFreezeLogged(true);
      const trail = await appendEvent(
        dossier.auditTrail,
        "gel_avoirs_signale",
        "Projet de signalement de gel des avoirs préparé (à confirmer au registre national)",
      );
      onChange({ ...dossier, auditTrail: trail } as D);
    }
  }

  async function copyFreeze() {
    try {
      await navigator.clipboard.writeText(`${freezeNotice.objet}\n\n${freezeNotice.corps}`);
      setFreezeCopied(true);
      setTimeout(() => setFreezeCopied(false), 2000);
    } catch {
      setFreezeCopied(false);
    }
  }

  async function onDecision(decision: HumanDecision) {
    const trail = await appendEvent(
      dossier.auditTrail,
      "decision_saisie",
      `Décision : ${DECISION_LABEL[decision.type]} — ${decision.signataire || "non signé"}`,
    );
    setSaved(false);
    onChange({ ...dossier, decision, auditTrail: trail } as D);
  }

  // #1 — Attestation de revue des registres : consigne un constat HUMAIN.
  async function attesterRegistres() {
    setAttesting(true);
    try {
      const trail = await appendEvent(
        dossier.auditTrail,
        "registres_attestes",
        attestationDetail(registres, settings.signataire),
      );
      onChange({ ...dossier, auditTrail: trail } as D);
    } finally {
      setAttesting(false);
    }
  }

  // #10 — Horodatage qualifié : seule l'empreinte (dernier hash de la chaîne) sort.
  async function horodater() {
    const empreinte = dossier.auditTrail.at(-1)?.hash;
    if (!empreinte) return;
    setStamping(true);
    try {
      const token = await requestTimestamp(empreinte, settings.horodatageTsaUrl);
      const trail = await appendEvent(
        dossier.auditTrail,
        "horodatage_appose",
        `Empreinte ${empreinte.slice(0, 16)}… horodatée (RFC 3161) par ${settings.horodatageTsaUrl}`,
      );
      onChange({ ...dossier, horodatage: token, auditTrail: trail } as D);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Horodatage impossible.");
    } finally {
      setStamping(false);
    }
  }

  async function archive() {
    const trail = await appendEvent(
      dossier.auditTrail,
      "dossier_archive",
      "Dossier archivé dans l'historique local",
    );
    const finalDossier = { ...dossier, auditTrail: trail } as D;
    try {
      await upsertDossier(finalDossier);
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

      {freezeObligation && (
        <div className="mb-5 rounded-md border-2 border-risk-high bg-risk-high-bg/60 p-4">
          <p className="text-[0.82rem] font-medium text-risk-high">
            ⛔ Correspondance de sanction — gel des avoirs possible
          </p>
          <p className="mt-1.5 text-[0.76rem] leading-relaxed text-ink-soft">
            Un screening a renvoyé une correspondance de sanction. <strong>Vérifiez-la
            d'abord dans le registre national des gels.</strong> Si elle est confirmée,
            la mesure de gel est applicable <strong>sans délai</strong> (art. L. 562-4 du
            Code monétaire et financier) : ne mettez aucun fonds à disposition, ne
            finalisez pas l'opération, et signalez à la DG&nbsp;Trésor
            ({DGTRESOR_EMAIL}). Cette obligation est distincte d'une déclaration Tracfin.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={REGISTRE_GELS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[0.78rem] font-medium text-risk-high underline-offset-2 hover:underline"
            >
              Vérifier dans le registre national des gels ↗
            </a>
            <Button variant="ghost" onClick={revealFreeze}>
              {showFreeze ? "Masquer le signalement" : "Préparer le signalement DG Trésor"}
            </Button>
            {showFreeze && (
              <>
                <button
                  onClick={copyFreeze}
                  className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
                >
                  {freezeCopied ? "✓ Copié" : "Copier"}
                </button>
                <button
                  onClick={() => downloadFreezeNotice(freezeNotice, dossier)}
                  className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
                >
                  Télécharger (.txt)
                </button>
              </>
            )}
          </div>
          {showFreeze && (
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 font-sans text-[0.74rem] leading-relaxed text-ink-soft">
              {freezeNotice.corps}
            </pre>
          )}
        </div>
      )}

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

      {registres.length > 0 && (
        <div className="mt-4 rounded-md border border-line bg-surface-2 p-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="label-eyebrow text-gold">Attestation de revue des registres</span>
            <span className="text-[0.7rem] text-muted">
              {revue.constates}/{revue.total} constaté{revue.constates > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mb-2 text-[0.72rem] leading-relaxed text-muted">
            L'outil n'affirme jamais « aucun match » à votre place. Attestez avoir
            consulté chaque registre et constaté les résultats : la déclaration est
            consignée telle quelle dans la piste d'audit.
          </p>
          {!revue.tousConstates && (
            <InlineAlert tone="warn">
              {revue.restants} registre{revue.restants > 1 ? "s" : ""} encore « non vérifié » —
              renseignez chaque résultat avant d'attester.
            </InlineAlert>
          )}
          {dejaAtteste ? (
            <p className="mt-2 text-[0.74rem] text-risk-low">✓ Revue des registres attestée et consignée.</p>
          ) : (
            <div className="mt-2">
              <Button
                variant="ghost"
                onClick={attesterRegistres}
                disabled={!revue.tousConstates || attesting}
              >
                {attesting ? "Consignation…" : "Attester la revue des registres"}
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 rounded-md border border-line bg-surface-2 p-3 text-[0.72rem] leading-relaxed text-ink-soft">
        <strong className="font-medium">Responsabilité.</strong> {PENAL_RESPONSIBILITY_NOTICE}
      </p>

      <div className="mt-5">
        <AuditTimeline trail={dossier.auditTrail} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => setShowPdf(true)}>Aperçu du dossier (PDF)</Button>
        <Button variant="ghost" onClick={archive} disabled={!canArchive}>
          {saved ? "✓ Dossier archivé" : "Archiver le dossier"}
        </Button>
        {horodatageActif && (
          <Button variant="ghost" onClick={horodater} disabled={stamping || !dossier.auditTrail.length}>
            {stamping ? "Horodatage…" : dossier.horodatage ? "✓ Horodaté (RFC 3161)" : "Horodater (RFC 3161)"}
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          Nouveau dossier
        </Button>
        {!dossier.decision && (
          <span className="text-[0.72rem] text-muted">
            Saisissez une décision pour pouvoir archiver.
          </span>
        )}
      </div>
      {horodatageActif && (
        <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">
          Horodatage qualifié activé : seule l'empreinte SHA-256 du dossier est
          transmise à l'autorité d'horodatage — aucune donnée nominative.
        </p>
      )}

      <ReportPreviewModal dossier={dossier} open={showPdf} onClose={() => setShowPdf(false)} />
    </div>
  );
}
