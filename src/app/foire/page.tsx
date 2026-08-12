"use client";

/*
  Mode SAISIE RAPIDE « foire / exposition » (#13).

  Contexte : stand de foire, tablette ou mobile, connexion incertaine. On capture
  l'essentiel (identité sommaire, œuvre, montant, photo de la pièce) et on obtient
  une ÉVALUATION PRIMAIRE locale — sans screening réseau. Le dossier est
  enregistré « à finaliser » : au retour à la galerie, on le rouvre pour lancer le
  screening, compléter les pièces et trancher.

  HONNÊTETÉ : aucune évaluation primaire ne vaut décision. Le screening n'étant pas
  effectué ici, le dossier est explicitement marqué incomplet et non probant.
  Tout reste local et chiffré.
*/

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, InlineAlert, RiskBadge, SectionTitle } from "@/components/ui";
import { ImageDropzone } from "@/components/ImageDropzone";
import { aggregateTransaction, assessActor, assessArtwork, freshComportement } from "@/lib/scoring";
import { buildTrail } from "@/lib/audit";
import { emptyActor, emptyArtwork, newId } from "@/lib/factories";
import { loadSettings, saveDossier } from "@/lib/storage";
import { setReopen } from "@/lib/reopen";
import type { RiskLevel, ScreeningResult, Settings, TransactionDossier } from "@/lib/types";

export default function FoirePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [nom, setNom] = useState("");
  const [montant, setMontant] = useState("");
  const [titre, setTitre] = useState("");
  const [artiste, setArtiste] = useState("");
  const [piece, setPiece] = useState<string | null>(null);
  const [pieceNom, setPieceNom] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; niveau: RiskLevel } | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const seuilEur = settings?.seuilVigilanceEur ?? 10000;
  const montantEur = montant.trim() ? Number(montant.replace(/[^\d.]/g, "")) : null;
  const canSave = nom.trim().length > 0;

  async function enregistrer() {
    const acheteur = {
      ...emptyActor("acheteur"),
      nom: nom.trim(),
      transactionSuperieureSeuil: montantEur != null && montantEur >= seuilEur,
      pieceIdentiteDoc: piece,
      pieceIdentiteDocNom: pieceNom,
    };
    const artwork = { ...emptyArtwork(), titre: titre.trim(), artiste: artiste.trim() };

    // Screening NON effectué (mode hors-ligne) — tracé honnêtement.
    const screening: ScreeningResult = {
      sujet: nom.trim(),
      status: "error",
      matches: [],
      listesInterrogees: [],
      fournisseur: "saisie-rapide (hors-ligne)",
      horodatage: new Date().toISOString(),
      desambiguise: false,
      message: "Screening non effectué en saisie rapide — à lancer au retour.",
    };
    const ctx = { seuilVigilanceEur: seuilEur, montantEur };
    const assessment = assessActor(acheteur, screening, [], ctx);
    const oeuvreAssessment = assessArtwork(artwork);
    const agg = aggregateTransaction({
      montantEur,
      acheteur: assessment,
      vendeur: null,
      oeuvre: oeuvreAssessment,
      comportement: freshComportement(),
    });

    const auditTrail = await buildTrail([
      { type: "dossier_cree", detail: `Saisie rapide (foire) — ${nom.trim()} · à finaliser` },
      { type: "screening_resultat", detail: "Screening non effectué (hors-ligne) — à lancer au retour" },
      ...(piece ? [{ type: "piece_ajoutee" as const, detail: "Pièce d'identité capturée en mobilité" }] : []),
    ]);

    const id = newId();
    const dossier: TransactionDossier = {
      id,
      date: new Date().toISOString(),
      kind: "transaction",
      mode: "vente",
      montantEur,
      acheteur: { actor: acheteur, screening, beneficiairesScreening: [], assessment },
      vendeur: null,
      oeuvre: { artwork, assessment: oeuvreAssessment },
      comportement: freshComportement(),
      niveau: agg.niveau,
      facteurs: agg.facteurs,
      auditTrail,
      decision: null,
      aFinaliser: true,
    };

    try {
      await saveDossier(dossier);
      setSaved({ id, niveau: agg.niveau });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  function finaliser() {
    if (!saved) return;
    setReopen(saved.id);
    router.push("/transaction");
  }

  function nouvelle() {
    setNom("");
    setMontant("");
    setTitre("");
    setArtiste("");
    setPiece(null);
    setPieceNom(null);
    setSaved(null);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8 sm:px-8">
      <header className="mb-6">
        <div className="label-eyebrow mb-1">Saisie rapide — foire / exposition</div>
        <h1 className="font-serif text-2xl text-ink">Prise d'option express</h1>
        <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">
          L'essentiel en quelques secondes, même hors-ligne. Le dossier est
          enregistré « à finaliser » — screening et décision au retour à la galerie.
        </p>
      </header>

      {saved ? (
        <Card className="animate-rise">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle eyebrow={`Réf. ${saved.id}`}>Évaluation primaire</SectionTitle>
            <RiskBadge niveau={saved.niveau} />
          </div>
          <InlineAlert tone="warn">
            Évaluation <strong>primaire et non probante</strong> : le screening n'a pas
            été effectué. Finalisez le dossier au retour (screening, pièces, décision).
          </InlineAlert>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={finaliser}>Finaliser maintenant →</Button>
            <Button variant="ghost" onClick={nouvelle}>
              Nouvelle saisie
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <Field
              label="Nom du client"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom / raison sociale"
            />
            <Field
              label="Montant (€)"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Déclenche le seuil de vigilance"
              inputMode="numeric"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Œuvre (titre)" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Sans titre" />
              <Field label="Artiste" value={artiste} onChange={(e) => setArtiste(e.target.value)} placeholder="—" />
            </div>
            <ImageDropzone
              label="Pièce d'identité (photo)"
              hint="Prise avec l'appareil · reste sur cet appareil, jamais transmise"
              value={piece}
              fileName={pieceNom}
              onChange={(dataUrl, name) => {
                setPiece(dataUrl);
                setPieceNom(name);
              }}
            />
            {montantEur != null && montantEur >= seuilEur && !piece && (
              <InlineAlert tone="warn">
                Montant au-dessus du seuil ({seuilEur.toLocaleString("fr-FR")} €) : la
                pièce d'identité sera requise pour finaliser.
              </InlineAlert>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={enregistrer} disabled={!canSave}>
              Enregistrer (à finaliser)
            </Button>
            {!canSave && <span className="text-[0.72rem] text-muted">Nom requis.</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
