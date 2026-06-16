"use client";

/*
  Module ACTEUR (autonome). Due diligence d'une personne OU d'une entité, par
  approche des risques : par défaut vigilance simplifiée, aucune pièce intrusive.
*/

import { useEffect, useState } from "react";
import { Button, Card, RiskBadge, SectionTitle, SubScores, TierBadge } from "@/components/ui";
import { ActorForm } from "@/components/ActorForm";
import { ScreeningResultCard } from "@/components/ScreeningResultCard";
import { CollectionPanel } from "@/components/CollectionPanel";
import { CompliancePanel } from "@/components/CompliancePanel";
import {
  collectBeneficiarySubjects,
  runScreening,
  subjectFromActor,
} from "@/lib/screening";
import { assessActor } from "@/lib/scoring";
import { appendEvent, buildTrail } from "@/lib/audit";
import { classifyMatches } from "@/lib/classify";
import { emptyActor, newId } from "@/lib/factories";
import { loadSettings } from "@/lib/storage";
import type {
  Actor,
  ActorDossier,
  ScreeningMatch,
  ScreeningResult,
  Settings,
} from "@/lib/types";

export default function ActeurPage() {
  const [actor, setActor] = useState<Actor>(() => emptyActor("acheteur"));
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [result, setResult] = useState<ActorDossier | null>(null);

  useEffect(() => setSettings(loadSettings()), []);

  const hasKey = !!settings?.apiKey;
  // Pièce d'identité obligatoire pour créer le dossier si la case acheteur est cochée.
  const idManquante =
    actor.role === "acheteur" &&
    actor.transactionSuperieureSeuil &&
    !actor.pieceIdentiteDoc;
  const canRun = actor.nom.trim().length > 0 && !idManquante;

  async function lancer() {
    if (!settings) return;
    setRunning(true);
    setResult(null);
    const cred = { fournisseur: settings.fournisseur, apiKey: settings.apiKey };

    const screening = await runScreening(subjectFromActor(actor), cred);
    const beneficiairesScreening: ScreeningResult[] =
      actor.kind === "entite"
        ? await Promise.all(
            collectBeneficiarySubjects(actor.beneficiaires).map((s) =>
              runScreening(s, cred),
            ),
          )
        : [];

    const assessment = assessActor(actor, screening, beneficiairesScreening, {
      seuilVigilanceEur: settings.seuilVigilanceEur,
      montantEur: null,
    });

    const auditTrail = await buildTrail([
      { type: "dossier_cree", detail: `Dossier acteur créé — ${actor.nom || "sans nom"}` },
      { type: "screening_lance", detail: `Screening lancé (${settings.fournisseur}) sur l'acteur` },
      { type: "screening_resultat", detail: `Résultat acteur : ${screening.status}` },
      ...beneficiairesScreening.map((r, i) => ({
        type: "screening_resultat" as const,
        detail: `Résultat bénéficiaire effectif ${i + 1} : ${r.status}`,
      })),
      ...(actor.pieceIdentiteDoc
        ? [{ type: "piece_ajoutee" as const, detail: "Pièce d'identité jointe au dossier" }]
        : []),
    ]);

    setResult({
      id: newId(),
      date: new Date().toISOString(),
      kind: "acteur",
      actor,
      screening,
      beneficiairesScreening,
      assessment,
      auditTrail,
      decision: null,
    });
    setRunning(false);
  }

  function reset() {
    setActor(emptyActor("acheteur"));
    setResult(null);
  }

  // Faux positifs : écarter/rétablir une correspondance recalcule la synthèse
  // (statut effectif) et, si c'est un changement d'état, journalise l'action.
  async function updateScreening(
    target: "actor" | number,
    matches: ScreeningMatch[],
    audited: boolean,
  ) {
    if (!result || !settings) return;
    const newStatus = (s: ScreeningResult) =>
      s.status === "demo" || s.status === "error" ? s.status : classifyMatches(matches);

    let screening = result.screening;
    let beneficiaires = result.beneficiairesScreening;
    if (target === "actor") {
      screening = { ...screening, matches, status: newStatus(screening) };
    } else {
      beneficiaires = beneficiaires.map((b, i) =>
        i === target ? { ...b, matches, status: newStatus(b) } : b,
      );
    }
    const assessment = assessActor(result.actor, screening, beneficiaires, {
      seuilVigilanceEur: settings.seuilVigilanceEur,
      montantEur: null,
    });
    const auditTrail = audited
      ? await appendEvent(
          result.auditTrail,
          "match_ecarte",
          "Correspondance de screening écartée/rétablie (faux positif)",
        )
      : result.auditTrail;
    setResult({ ...result, screening, beneficiairesScreening: beneficiaires, assessment, auditTrail });
  }

  return (
    <div className="mx-auto max-w-4xl px-10 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Due diligence — acteur</div>
          <h1 className="font-serif text-3xl text-ink">Vigilance acteur</h1>
          <p className="mt-1 text-sm text-muted">
            Personne ou entité. L'outil cherche au lieu de demander, et ne réclame
            une pièce que si le risque l'exige.
          </p>
        </div>
        {!hasKey && (
          <a
            href="/parametres"
            className="rounded-md border border-risk-mid/40 bg-risk-mid-bg px-3 py-2 text-[0.72rem] text-risk-mid"
          >
            ⚠︎ Aucune clé API — screening en mode démonstration
          </a>
        )}
      </header>

      <Card>
        <SectionTitle eyebrow="Saisie minimale">Acteur</SectionTitle>
        <ActorForm
          actor={actor}
          onChange={setActor}
          seuilEur={settings?.seuilVigilanceEur ?? 10000}
        />
      </Card>

      <div className="mt-6 flex items-center gap-4">
        <Button onClick={lancer} disabled={!canRun || running}>
          {running ? "Analyse en cours…" : "Créer le dossier client"}
        </Button>
        {idManquante ? (
          <span className="text-[0.72rem] text-risk-high">
            Pièce d'identité obligatoire pour une transaction au-dessus du seuil —
            ajoutez-la pour créer le dossier.
          </span>
        ) : actor.nom.trim().length === 0 ? (
          <span className="text-[0.72rem] text-muted">
            Renseignez au moins le nom / la raison sociale.
          </span>
        ) : null}
      </div>

      {result && settings && (
        <div className="mt-8 animate-rise">
          <Card className="border-line-strong">
            <div className="flex items-start justify-between gap-4">
              <SectionTitle eyebrow={`Dossier client · Réf. ${result.id}`}>
                Dossier Client
              </SectionTitle>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <TierBadge tier={result.assessment.tier} />
                <RiskBadge niveau={result.assessment.niveau} />
              </div>
            </div>

            {result.actor.pieceIdentiteDoc && (
              <div className="mb-5">
                <div className="label-eyebrow mb-2">Pièce d'identité au dossier</div>
                <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.actor.pieceIdentiteDoc}
                    alt="Pièce d'identité"
                    className="h-16 w-24 rounded border border-line object-cover"
                  />
                  <span className="text-[0.75rem] text-ink-soft">
                    {result.actor.pieceIdentiteDocNom ?? "pièce d'identité"} · conservée
                    localement
                  </span>
                </div>
              </div>
            )}

            <div className="mb-5">
              <div className="label-eyebrow mb-2">Sous-scores</div>
              <SubScores scores={result.assessment.sousScores} />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3">
              <ScreeningResultCard
                titre="Screening de l'acteur"
                r={result.screening}
                onMatchesChange={(m, a) => updateScreening("actor", m, a)}
              />
              {result.beneficiairesScreening.map((r, i) => (
                <ScreeningResultCard
                  key={i}
                  titre={`Bénéficiaire effectif ${i + 1}`}
                  r={r}
                  onMatchesChange={(m, a) => updateScreening(i, m, a)}
                />
              ))}
            </div>

            <div className="mb-5">
              <div className="label-eyebrow mb-2">Pièces à collecter</div>
              <CollectionPanel
                actor={result.actor}
                pieces={result.assessment.piecesACollecter}
                settings={settings}
              />
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
              synthèse est une aide à la vigilance LCB-FT. Les niveaux et seuils sont
              indicatifs et doivent être validés par un juriste.
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
