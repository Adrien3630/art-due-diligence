"use client";

/*
  Module TRANSACTION. Réunit acheteur + (vendeur) + œuvre et AGRÈGE leurs
  synthèses — sans rien réinventer. Ajoute le risque purement transactionnel
  (espèces, paiement par un tiers, urgence).
*/

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  RiskBadge,
  SectionTitle,
  SubScores,
  TierBadge,
} from "@/components/ui";
import { ActorForm } from "@/components/ActorForm";
import { ArtworkForm } from "@/components/ArtworkForm";
import { AuditList } from "@/components/AuditList";
import { ScreeningResultCard } from "@/components/ScreeningResultCard";
import { CollectionPanel } from "@/components/CollectionPanel";
import { CompliancePanel } from "@/components/CompliancePanel";
import {
  collectBeneficiarySubjects,
  runScreening,
  subjectFromActor,
  type ScreeningCred,
} from "@/lib/screening";
import {
  aggregateTransaction,
  assessActor,
  assessArtwork,
  freshComportement,
} from "@/lib/scoring";
import { appendEvent, buildTrail } from "@/lib/audit";
import { classifyMatches } from "@/lib/classify";
import { emptyActor, emptyArtwork, newId } from "@/lib/factories";
import { loadHistory, loadSettings } from "@/lib/storage";
import { takeReopen } from "@/lib/reopen";
import type {
  Actor,
  AuditAnswer,
  Artwork,
  ScreeningMatch,
  ScreeningResult,
  Settings,
  TransactionDossier,
  TransactionParty,
} from "@/lib/types";

async function screenParty(
  actor: Actor,
  cred: ScreeningCred,
  ctx: { seuilVigilanceEur: number; montantEur: number | null },
): Promise<TransactionParty> {
  const screening = await runScreening(subjectFromActor(actor), cred);
  const beneficiairesScreening: ScreeningResult[] =
    actor.kind === "entite"
      ? await Promise.all(
          collectBeneficiarySubjects(actor.beneficiaires).map((s) => runScreening(s, cred)),
        )
      : [];
  const assessment = assessActor(actor, screening, beneficiairesScreening, ctx);
  return { actor, screening, beneficiairesScreening, assessment };
}

function PartyResult({
  titre,
  which,
  party,
  settings,
  onMatchesChange,
}: {
  titre: string;
  which: "acheteur" | "vendeur";
  party: TransactionParty;
  settings: Settings;
  onMatchesChange: (
    which: "acheteur" | "vendeur",
    matches: ScreeningMatch[],
    audited: boolean,
  ) => void;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="label-eyebrow text-gold">{titre}</span>
        <div className="flex items-center gap-2">
          <TierBadge tier={party.assessment.tier} />
          <RiskBadge niveau={party.assessment.niveau} size="sm" />
        </div>
      </div>
      <SubScores scores={party.assessment.sousScores} />
      <div className="mt-3 space-y-2">
        <ScreeningResultCard
          titre="Screening"
          r={party.screening}
          onMatchesChange={(m, a) => onMatchesChange(which, m, a)}
        />
      </div>
      <div className="mt-3">
        <div className="label-eyebrow mb-1.5">Pièces à collecter</div>
        <CollectionPanel
          actor={party.actor}
          pieces={party.assessment.piecesACollecter}
          settings={settings}
        />
      </div>
    </div>
  );
}

export default function TransactionPage() {
  const [acheteur, setAcheteur] = useState<Actor>(() => emptyActor("acheteur"));
  const [vendeur, setVendeur] = useState<Actor>(() => emptyActor("vendeur"));
  const [withVendeur, setWithVendeur] = useState(true);
  const [artwork, setArtwork] = useState<Artwork>(() => emptyArtwork());
  const [comportement, setComportement] = useState<AuditAnswer[]>(() => freshComportement());
  const [montant, setMontant] = useState("");
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [result, setResult] = useState<TransactionDossier | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    const id = takeReopen();
    if (id) {
      const d = loadHistory().find((x) => x.id === id);
      if (d && d.kind === "transaction") {
        setAcheteur(d.acheteur.actor);
        setVendeur(d.vendeur?.actor ?? emptyActor("vendeur"));
        setWithVendeur(!!d.vendeur);
        setArtwork(d.oeuvre.artwork);
        setComportement(d.comportement);
        setMontant(d.montantEur != null ? String(d.montantEur) : "");
        setResult(d);
      }
    }
  }, []);

  // Pièce d'identité acheteur obligatoire si la case « > seuil » est cochée.
  const idManquante =
    acheteur.transactionSuperieureSeuil && !acheteur.pieceIdentiteDoc;
  const canRun = acheteur.nom.trim().length > 0 && !idManquante;
  const hasKey = !!settings?.apiKey;
  const seuilEur = settings?.seuilVigilanceEur ?? 10000;
  // Montant saisi → alimente le verdict de cohérence de prix dans l'œuvre.
  const montantEur = montant.trim() ? Number(montant.replace(/[^\d.]/g, "")) : null;

  async function lancer() {
    if (!settings) return;
    setRunning(true);
    setResult(null);
    const cred: ScreeningCred = { fournisseur: settings.fournisseur, apiKey: settings.apiKey };
    const ctx = { seuilVigilanceEur: settings.seuilVigilanceEur, montantEur };

    const acheteurParty = await screenParty(acheteur, cred, ctx);
    const vendeurParty =
      withVendeur && vendeur.nom.trim() ? await screenParty(vendeur, cred, ctx) : null;
    const oeuvreAssessment = assessArtwork(artwork);

    const agg = aggregateTransaction({
      montantEur,
      acheteur: acheteurParty.assessment,
      vendeur: vendeurParty?.assessment ?? null,
      oeuvre: oeuvreAssessment,
      comportement,
    });

    const auditTrail = await buildTrail([
      { type: "dossier_cree", detail: "Dossier transaction créé" },
      { type: "screening_lance", detail: `Screening lancé (${settings.fournisseur}) sur les parties` },
      { type: "screening_resultat", detail: `Résultat acheteur : ${acheteurParty.screening.status}` },
      ...(vendeurParty
        ? [{ type: "screening_resultat" as const, detail: `Résultat vendeur : ${vendeurParty.screening.status}` }]
        : []),
      ...(acheteur.pieceIdentiteDoc
        ? [{ type: "piece_ajoutee" as const, detail: "Pièce d'identité de l'acheteur jointe" }]
        : []),
    ]);

    setResult({
      id: newId(),
      date: new Date().toISOString(),
      kind: "transaction",
      montantEur,
      acheteur: acheteurParty,
      vendeur: vendeurParty,
      oeuvre: { artwork, assessment: oeuvreAssessment },
      comportement,
      niveau: agg.niveau,
      facteurs: agg.facteurs,
      auditTrail,
      decision: null,
    });
    setRunning(false);
  }

  function reset() {
    setAcheteur(emptyActor("acheteur"));
    setVendeur(emptyActor("vendeur"));
    setArtwork(emptyArtwork());
    setComportement(freshComportement());
    setMontant("");
    setResult(null);
  }

  // Faux positifs sur une partie : recalcule son volet, ré-agrège la transaction
  // et journalise le changement d'état.
  async function updatePartyScreening(
    which: "acheteur" | "vendeur",
    matches: ScreeningMatch[],
    audited: boolean,
  ) {
    if (!result || !settings) return;
    const ctx = { seuilVigilanceEur: settings.seuilVigilanceEur, montantEur: result.montantEur };
    const updateParty = (p: TransactionParty): TransactionParty => {
      const status =
        p.screening.status === "demo" || p.screening.status === "error"
          ? p.screening.status
          : classifyMatches(matches);
      const screening = { ...p.screening, matches, status };
      return { ...p, screening, assessment: assessActor(p.actor, screening, p.beneficiairesScreening, ctx) };
    };
    const acheteur = which === "acheteur" ? updateParty(result.acheteur) : result.acheteur;
    const vendeur =
      which === "vendeur" && result.vendeur ? updateParty(result.vendeur) : result.vendeur;
    const agg = aggregateTransaction({
      montantEur: result.montantEur,
      acheteur: acheteur.assessment,
      vendeur: vendeur?.assessment ?? null,
      oeuvre: result.oeuvre.assessment,
      comportement: result.comportement,
    });
    const auditTrail = audited
      ? await appendEvent(
          result.auditTrail,
          "match_ecarte",
          `Correspondance écartée/rétablie sur le ${which} (faux positif)`,
        )
      : result.auditTrail;
    setResult({ ...result, acheteur, vendeur, niveau: agg.niveau, facteurs: agg.facteurs, auditTrail });
  }

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="label-eyebrow mb-1">Due diligence — transaction</div>
          <h1 className="font-serif text-3xl text-ink">Dossier transaction</h1>
          <p className="mt-1 text-sm text-muted">
            Acheteur, vendeur et œuvre réunis. Chaque volet garde sa synthèse ; la
            transaction les agrège.
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

      <div className="space-y-6">
        <Card>
          <SectionTitle eyebrow="Volet acteur">Acheteur</SectionTitle>
          <ActorForm
            actor={acheteur}
            onChange={setAcheteur}
            hideRole
            seuilEur={seuilEur}
          />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle eyebrow="Volet acteur">Vendeur</SectionTitle>
            <label className="flex items-center gap-2 text-[0.78rem] text-ink-soft">
              <input
                type="checkbox"
                checked={withVendeur}
                onChange={(e) => setWithVendeur(e.target.checked)}
              />
              Inclure le vendeur
            </label>
          </div>
          {withVendeur ? (
            <ActorForm actor={vendeur} onChange={setVendeur} hideRole />
          ) : (
            <p className="text-[0.78rem] text-muted">Vendeur exclu de ce dossier.</p>
          )}
        </Card>

        <Card>
          <SectionTitle eyebrow="Volet œuvre">Œuvre</SectionTitle>
          <ArtworkForm artwork={artwork} onChange={setArtwork} montantEur={montantEur} />
        </Card>

        <Card>
          <SectionTitle eyebrow="Volet transaction">Conditions & comportement</SectionTitle>
          <div className="mb-4 max-w-xs">
            <label className="block">
              <span className="label-eyebrow block mb-1.5">Montant (€)</span>
              <input
                className="input-line"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Déclenche le seuil de vigilance"
                inputMode="numeric"
              />
            </label>
          </div>
          <AuditList answers={comportement} onChange={setComportement} />
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Button onClick={lancer} disabled={!canRun || running}>
          {running ? "Analyse en cours…" : "Créer le dossier"}
        </Button>
        {idManquante ? (
          <span className="text-[0.72rem] text-risk-high">
            Pièce d'identité de l'acheteur obligatoire (transaction au-dessus du
            seuil) — ajoutez-la pour créer le dossier.
          </span>
        ) : acheteur.nom.trim().length === 0 ? (
          <span className="text-[0.72rem] text-muted">
            Renseignez au moins le nom de l'acheteur.
          </span>
        ) : null}
      </div>

      {result && settings && (
        <div className="mt-8 animate-rise">
          <Card className="border-line-strong">
            <div className="flex items-start justify-between gap-4">
              <SectionTitle eyebrow={`Réf. ${result.id}`}>
                Synthèse de la transaction
              </SectionTitle>
              <RiskBadge niveau={result.niveau} />
            </div>

            <div className="mb-5">
              <div className="label-eyebrow mb-2">Facteurs agrégés</div>
              <ul className="space-y-1.5">
                {result.facteurs.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-gold">—</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PartyResult
                titre="Acheteur"
                which="acheteur"
                party={result.acheteur}
                settings={settings}
                onMatchesChange={updatePartyScreening}
              />
              {result.vendeur && (
                <PartyResult
                  titre="Vendeur"
                  which="vendeur"
                  party={result.vendeur}
                  settings={settings}
                  onMatchesChange={updatePartyScreening}
                />
              )}
              <div className="rounded-md border border-line bg-surface-2 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="label-eyebrow text-gold">Œuvre</span>
                  <RiskBadge niveau={result.oeuvre.assessment.niveau} size="sm" />
                </div>
                <SubScores scores={result.oeuvre.assessment.sousScores} />
              </div>
            </div>

            <div className="mt-5 rounded-md border border-line bg-surface-2 p-3 text-[0.72rem] leading-relaxed text-ink-soft">
              <strong className="font-medium">Décision humaine requise.</strong> Cette
              synthèse agrège des aides à la vigilance. Elle ne vaut ni
              authentification, ni garantie, ni dispense de déclaration de soupçon le
              cas échéant.
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
