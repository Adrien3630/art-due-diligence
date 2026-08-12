"use client";

/*
  Saisie d'un acteur : personne physique OU entité morale.
  Principe directeur : saisie MINIMALE. On ne réclame que l'identité de base ;
  date de naissance / nationalité servent à désambiguïser le screening (moins de
  faux positifs), pas à interroger le client. Les indices de vigilance sont
  FACULTATIFS.
*/

import { useMemo, useState } from "react";
import { Field, AutoField, InlineAlert, SectionTitle } from "@/components/ui";
import { AuditList } from "@/components/AuditList";
import { ImageDropzone } from "@/components/ImageDropzone";
import { BeneficiaryEditor } from "@/components/BeneficiaryEditor";
import { emptyBeneficiary } from "@/lib/factories";
import { runOcr, parseIdentityText, parseEntityText, parseBeneficiaries } from "@/lib/ocr";
import { applyWatermark, watermarkLabel } from "@/lib/watermark";
import { searchActors } from "@/lib/antecedents";
import { suggest } from "@/lib/suggestions";
import { loadHistory, loadSettings } from "@/lib/storage";
import type { Actor, ActorKind, ActorRole, BeneficialOwner } from "@/lib/types";

/**
 * Antécédent inter-dossiers (#9) : signale un profil PROCHE déjà évalué et
 * propose de le réimporter. On ne fusionne jamais d'office — l'humain reconnaît.
 */
function AntecedentHint({
  query,
  onReuse,
}: {
  query: string;
  onReuse: (a: Actor) => void;
}) {
  const history = useMemo(() => loadHistory(), []);
  const matches = useMemo(() => searchActors(history, query, { limit: 1 }), [history, query]);
  if (!matches.length) return null;
  const m = matches[0];
  return (
    <div className="col-span-2 -mt-2">
      <InlineAlert tone="info">
        Profil proche déjà au dossier : <strong>{m.nom}</strong>
        {m.role ? ` (${m.role})` : ""} —{" "}
        {new Date(m.date).toLocaleDateString("fr-FR")}.{" "}
        <button
          type="button"
          onClick={() => onReuse(m.actor)}
          className="font-medium underline underline-offset-2"
        >
          Réutiliser ce profil
        </button>
      </InlineAlert>
    </div>
  );
}

const ROLE_LABEL: Record<ActorRole, string> = {
  acheteur: "Acheteur",
  vendeur: "Vendeur",
  intermediaire: "Intermédiaire",
};

/**
 * Analyse OCR ASSISTÉE d'une pièce (100 % locale). Propose des champs éditables ;
 * rien n'est appliqué sans un clic explicite de validation. L'image ne quitte
 * jamais la machine (tesseract.js / WebAssembly).
 */
type OcrRow = { key: keyof Actor; label: string; value: string };

function OcrAssist({
  dataUrl,
  kind,
  onApply,
  onApplyBeneficiaires,
}: {
  dataUrl: string;
  kind: ActorKind;
  onApply: (patch: Partial<Actor>) => void;
  onApplyBeneficiaires?: (bens: BeneficialOwner[]) => void;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rows, setRows] = useState<OcrRow[]>([]);
  const [bens, setBens] = useState<{ nom: string; prenoms: string; pourcentage: string }[]>([]);

  async function analyse() {
    setState("running");
    try {
      const text = await runOcr(dataUrl);
      const out: OcrRow[] = [];
      if (kind === "personne") {
        const c = parseIdentityText(text);
        if (c.nom) out.push({ key: "nom", label: "Nom", value: c.nom });
        if (c.prenoms) out.push({ key: "prenoms", label: "Prénom(s)", value: c.prenoms });
        if (c.dateNaissance)
          out.push({ key: "dateNaissance", label: "Naissance", value: c.dateNaissance });
        if (c.nationalite)
          out.push({ key: "nationalite", label: "Nationalité", value: c.nationalite });
      } else {
        const c = parseEntityText(text);
        if (c.nom) out.push({ key: "nom", label: "Raison sociale", value: c.nom });
        if (c.immatriculation)
          out.push({ key: "immatriculation", label: "Immatriculation", value: c.immatriculation });
        setBens(parseBeneficiaries(text));
      }
      setRows(out);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const toBeneficiary = (b: { nom: string; prenoms: string; pourcentage: string }): BeneficialOwner => ({
    ...emptyBeneficiary(),
    kind: "personne",
    nom: b.nom,
    prenoms: b.prenoms,
    pourcentage: b.pourcentage,
  });

  const setRow = (i: number, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value } : r)));

  return (
    <div className="mt-3 rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label-eyebrow">Pré-remplissage assisté (OCR local)</div>
        <button
          type="button"
          onClick={analyse}
          disabled={state === "running"}
          className="text-[0.74rem] font-medium text-gold underline-offset-2 hover:underline disabled:opacity-50"
        >
          {state === "running" ? "Analyse en cours…" : "Analyser la pièce ↻"}
        </button>
      </div>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
        L'analyse s'effectue sur cet appareil ; l'image n'est pas transmise. Les
        champs proposés sont <strong>éditables</strong> et ne sont appliqués qu'à
        votre validation.
      </p>
      {state === "error" && (
        <p className="mt-2 text-[0.72rem] text-risk-high">
          Lecture impossible — saisissez les champs manuellement.
        </p>
      )}
      {state === "done" && rows.length === 0 && (
        <p className="mt-2 text-[0.72rem] text-muted">
          Aucun champ exploitable détecté — saisie manuelle.
        </p>
      )}
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[0.72rem] text-muted">{r.label}</span>
              <input
                className="input-line flex-1"
                value={r.value}
                onChange={(e) => setRow(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onApply({ [r.key]: r.value } as Partial<Actor>)}
                className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[0.72rem] text-ink-soft hover:border-gold hover:text-gold"
              >
                Appliquer
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onApply(
                Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Actor>,
              )
            }
            className="text-[0.72rem] font-medium text-gold underline-offset-2 hover:underline"
          >
            Tout appliquer
          </button>
        </div>
      )}
      {onApplyBeneficiaires && bens.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="label-eyebrow mb-1 text-gold">
            Bénéficiaires effectifs proposés ({bens.length})
          </div>
          <p className="mb-2 text-[0.7rem] leading-relaxed text-muted">
            Cascade <strong>proposée</strong> à partir du document. Contrôlez chaque
            nœud (personne / entité, part) avant tout screening.
          </p>
          <div className="space-y-1.5">
            {bens.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[0.76rem]">
                <span className="flex-1 text-ink-soft">
                  {[b.prenoms, b.nom].filter(Boolean).join(" ")} — {b.pourcentage} %
                </span>
                <button
                  type="button"
                  onClick={() => onApplyBeneficiaires([toBeneficiary(b)])}
                  className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[0.72rem] text-ink-soft hover:border-gold hover:text-gold"
                >
                  Ajouter
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onApplyBeneficiaires(bens.map(toBeneficiary))}
              className="text-[0.72rem] font-medium text-gold underline-offset-2 hover:underline"
            >
              Tout ajouter à la cascade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={[
              "px-4 py-2 text-sm transition-colors",
              active ? "bg-ink text-bg" : "bg-surface text-ink-soft hover:bg-surface-2",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActorForm({
  actor,
  onChange,
  hideRole = false,
  seuilEur = 10000,
}: {
  actor: Actor;
  onChange: (a: Actor) => void;
  hideRole?: boolean;
  seuilEur?: number;
}) {
  const set = (patch: Partial<Actor>) => onChange({ ...actor, ...patch });
  const addBeneficiaires = (bens: BeneficialOwner[]) =>
    set({ beneficiaires: [...actor.beneficiaires, ...bens] });

  const history = useMemo(() => loadHistory(), []);
  const natSugg = useMemo(() => suggest(history, "nationalite"), [history]);
  const paysSugg = useMemo(() => suggest(history, "pays"), [history]);
  const formeSugg = useMemo(() => suggest(history, "formeJuridique"), [history]);

  // Filigranage indélébile de la pièce, en local (#8).
  const [filigrane, setFiligrane] = useState<"idle" | "busy" | "done">("idle");
  async function filigraner() {
    if (!actor.pieceIdentiteDoc) return;
    setFiligrane("busy");
    try {
      const label = watermarkLabel(loadSettings().nomGalerie, new Date().toISOString());
      const wm = await applyWatermark(actor.pieceIdentiteDoc, label);
      set({ pieceIdentiteDoc: wm });
      setFiligrane("done");
    } catch {
      setFiligrane("idle");
    }
  }

  const reuse = (a: Actor) => onChange({ ...a, role: actor.role });

  return (
    <div>
      {/* Type & rôle */}
      <div className="mb-5 flex flex-wrap items-end gap-6">
        <div>
          <span className="label-eyebrow block mb-1.5">Type d'acteur</span>
          <Segmented<ActorKind>
            value={actor.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { v: "personne", label: "Personne physique" },
              { v: "entite", label: "Entité morale" },
            ]}
          />
        </div>
        {!hideRole && (
          <div>
            <span className="label-eyebrow block mb-1.5">Rôle</span>
            <Segmented<ActorRole>
              value={actor.role}
              onChange={(role) => set({ role })}
              options={(["acheteur", "vendeur", "intermediaire"] as ActorRole[]).map(
                (r) => ({ v: r, label: ROLE_LABEL[r] }),
              )}
            />
          </div>
        )}
      </div>

      {/* Identité */}
      {actor.kind === "personne" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Nom"
            value={actor.nom}
            onChange={(e) => set({ nom: e.target.value })}
            placeholder="Dupont"
          />
          <Field
            label="Prénom(s)"
            value={actor.prenoms}
            onChange={(e) => set({ prenoms: e.target.value })}
            placeholder="Marie Claire"
          />
          <AntecedentHint query={[actor.prenoms, actor.nom].filter(Boolean).join(" ")} onReuse={reuse} />
          <Field
            label="Date de naissance"
            type="date"
            value={actor.dateNaissance}
            onChange={(e) => set({ dateNaissance: e.target.value })}
            hint="Sert à désambiguïser le screening — pas une question au client."
          />
          <AutoField
            label="Nationalité"
            value={actor.nationalite}
            onChange={(e) => set({ nationalite: e.target.value })}
            placeholder="Française"
            suggestions={natSugg}
          />
          <AutoField
            label="Pays de résidence"
            value={actor.pays}
            onChange={(e) => set({ pays: e.target.value })}
            placeholder="France"
            hint="Risque-pays GAFI dérivé automatiquement."
            suggestions={paysSugg}
          />
          <Field
            label="N° pièce d'identité (si déjà connu)"
            value={actor.pieceIdentite}
            onChange={(e) => set({ pieceIdentite: e.target.value })}
            placeholder="—"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Raison sociale"
            value={actor.nom}
            onChange={(e) => set({ nom: e.target.value })}
            placeholder="ArtHolding SARL"
          />
          <AntecedentHint query={actor.nom} onReuse={reuse} />
          <AutoField
            label="Forme juridique"
            value={actor.formeJuridique}
            onChange={(e) => set({ formeJuridique: e.target.value })}
            placeholder="SARL, SA, Fondation, Trust…"
            suggestions={formeSugg}
          />
          <Field
            label="N° d'immatriculation"
            value={actor.immatriculation}
            onChange={(e) => set({ immatriculation: e.target.value })}
            placeholder="SIREN / RCS / equiv."
          />
          <AutoField
            label="Juridiction"
            value={actor.pays}
            onChange={(e) => set({ pays: e.target.value })}
            placeholder="France"
            hint="Risque-pays GAFI dérivé automatiquement."
            suggestions={paysSugg}
          />
        </div>
      )}

      {/* Relation d'affaires & KYC (attendus LCB-FT) */}
      <div className="mt-6">
        <SectionTitle eyebrow="Connaissance client">Relation d'affaires</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field
              label={actor.kind === "entite" ? "Adresse du siège" : "Adresse complète"}
              value={actor.adresse}
              onChange={(e) => set({ adresse: e.target.value })}
              placeholder="N°, rue, code postal, ville, pays"
              hint="Complète le seul pays — utile à l'identification et aux courriers."
            />
          </div>
          <div className="col-span-2">
            <Field
              label="Objet & nature de la relation d'affaires"
              value={actor.objetRelation}
              onChange={(e) => set({ objetRelation: e.target.value })}
              placeholder="Achat ponctuel, collection régulière, mandat de vente…"
              hint="Attendu LCB-FT (art. L. 561-5-1 CMF) : ce que vous savez de l'opération et de son but."
            />
          </div>
          <div className="col-span-2">
            <Field
              label="Mandant / bénéficiaire réel de l'opération (si la partie agit pour un tiers)"
              value={actor.mandant}
              onChange={(e) => set({ mandant: e.target.value })}
              placeholder="Laisser vide si la partie agit pour son propre compte"
              hint="Si un tiers non identifié est en jeu, cochez l'indice correspondant ci-dessous."
            />
          </div>
          <div className="col-span-2">
            <Field
              label="Origine des fonds / du patrimoine"
              value={actor.origineFonds}
              onChange={(e) => set({ origineFonds: e.target.value })}
              placeholder="Cession d'actifs, revenus professionnels, héritage, financement bancaire…"
              hint="Requise en vigilance renforcée. La renseigner ici satisfait la pièce correspondante."
            />
          </div>
        </div>
      </div>

      {/* Seuil de transaction (acheteur) — déclenche la pièce d'identité obligatoire */}
      {actor.role === "acheteur" && (
        <div className="mt-6 rounded-md border border-line bg-surface-2 p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--color-gold)]"
              checked={actor.transactionSuperieureSeuil}
              onChange={(e) =>
                set({ transactionSuperieureSeuil: e.target.checked })
              }
            />
            <span>
              <span className="text-sm text-ink">
                Transaction de plus de {seuilEur.toLocaleString("fr-FR")} €
              </span>
              <span className="block text-[0.72rem] leading-relaxed text-muted">
                Si cochée, une pièce d'identité du client devient obligatoire pour
                créer le dossier (obligation LCB-FT au-dessus du seuil).
              </span>
            </span>
          </label>
          {actor.transactionSuperieureSeuil && (
            <div className="mt-4">
              <ImageDropzone
                label="Pièce d'identité du client"
                hint="Photo ou scan · JPEG, PNG · reste sur cet appareil, jamais transmise"
                required
                value={actor.pieceIdentiteDoc}
                fileName={actor.pieceIdentiteDocNom}
                onChange={(dataUrl, name) =>
                  set({ pieceIdentiteDoc: dataUrl, pieceIdentiteDocNom: name })
                }
              />
              {actor.pieceIdentiteDoc && (
                <>
                  <OcrAssist dataUrl={actor.pieceIdentiteDoc} kind={actor.kind} onApply={set} />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={filigraner}
                      disabled={filigrane === "busy"}
                      className="rounded-md border border-line px-3 py-1.5 text-[0.74rem] text-ink-soft hover:border-gold hover:text-gold disabled:opacity-50"
                    >
                      {filigrane === "busy" ? "Filigranage…" : "Filigraner la pièce ⚑"}
                    </button>
                    <span className="text-[0.7rem] text-muted">
                      {filigrane === "done"
                        ? "Filigrane appliqué (incrusté, local)."
                        : "Incruste « Due Diligence LCB-FT » dans l'image, sur cet appareil."}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bénéficiaires effectifs (entités) */}
      {actor.kind === "entite" && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-eyebrow text-gold">Bénéficiaires effectifs (UBO)</span>
            <button
              type="button"
              onClick={() =>
                set({ beneficiaires: [...actor.beneficiaires, emptyBeneficiary()] })
              }
              className="text-[0.72rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
            >
              + Ajouter un bénéficiaire
            </button>
          </div>
          <p className="mb-3 text-[0.72rem] leading-relaxed text-muted">
            L'accès public aux registres UBO est restreint dans l'UE depuis l'arrêt
            CJUE de novembre 2022 : déclarez ici ce qui est connu. Une entité sans
            bénéficiaire déclaré est traitée comme un point de transparence.
          </p>
          <div className="mb-3 rounded-md border border-line bg-surface-2 p-3">
            <ImageDropzone
              label="Document sociétaire (Kbis, statuts, déclaration DBE)"
              hint="Reste sur cet appareil · propose une cascade UBO à valider"
              value={actor.pieceIdentiteDoc}
              fileName={actor.pieceIdentiteDocNom}
              onChange={(dataUrl, name) =>
                set({ pieceIdentiteDoc: dataUrl, pieceIdentiteDocNom: name })
              }
            />
            {actor.pieceIdentiteDoc && (
              <OcrAssist
                dataUrl={actor.pieceIdentiteDoc}
                kind={actor.kind}
                onApply={set}
                onApplyBeneficiaires={addBeneficiaires}
              />
            )}
          </div>
          {actor.beneficiaires.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-strong bg-surface-2 px-4 py-3 text-[0.74rem] text-muted">
              Aucun bénéficiaire effectif déclaré.
            </div>
          ) : (
            <div className="space-y-3">
              {actor.beneficiaires.map((b, i) => (
                <BeneficiaryEditor
                  key={i}
                  value={b}
                  onChange={(nb) =>
                    set({
                      beneficiaires: actor.beneficiaires.map((x, j) => (j === i ? nb : x)),
                    })
                  }
                  onRemove={() =>
                    set({ beneficiaires: actor.beneficiaires.filter((_, j) => j !== i) })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indices de vigilance facultatifs */}
      <div className="mt-6">
        <SectionTitle eyebrow="Facultatif">Indices de vigilance</SectionTitle>
        <p className="-mt-3 mb-2 text-[0.72rem] leading-relaxed text-muted">
          À ne renseigner que si pertinent. Laissés vides, ils n'alourdissent pas
          le score — l'outil privilégie le minimum de questions.
        </p>
        <AuditList
          answers={actor.indices}
          onChange={(indices) => set({ indices })}
        />
      </div>
    </div>
  );
}
