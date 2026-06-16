"use client";

/*
  Saisie d'un acteur : personne physique OU entité morale.
  Principe directeur : saisie MINIMALE. On ne réclame que l'identité de base ;
  date de naissance / nationalité servent à désambiguïser le screening (moins de
  faux positifs), pas à interroger le client. Les indices de vigilance sont
  FACULTATIFS.
*/

import { Field, SectionTitle } from "@/components/ui";
import { AuditList } from "@/components/AuditList";
import { ImageDropzone } from "@/components/ImageDropzone";
import { BeneficiaryEditor } from "@/components/BeneficiaryEditor";
import { emptyBeneficiary } from "@/lib/factories";
import type { Actor, ActorKind, ActorRole } from "@/lib/types";

const ROLE_LABEL: Record<ActorRole, string> = {
  acheteur: "Acheteur",
  vendeur: "Vendeur",
  intermediaire: "Intermédiaire",
};

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
          <Field
            label="Date de naissance"
            type="date"
            value={actor.dateNaissance}
            onChange={(e) => set({ dateNaissance: e.target.value })}
            hint="Sert à désambiguïser le screening — pas une question au client."
          />
          <Field
            label="Nationalité"
            value={actor.nationalite}
            onChange={(e) => set({ nationalite: e.target.value })}
            placeholder="Française"
          />
          <Field
            label="Pays de résidence"
            value={actor.pays}
            onChange={(e) => set({ pays: e.target.value })}
            placeholder="France"
            hint="Risque-pays GAFI dérivé automatiquement."
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
          <Field
            label="Forme juridique"
            value={actor.formeJuridique}
            onChange={(e) => set({ formeJuridique: e.target.value })}
            placeholder="SARL, SA, Fondation, Trust…"
          />
          <Field
            label="N° d'immatriculation"
            value={actor.immatriculation}
            onChange={(e) => set({ immatriculation: e.target.value })}
            placeholder="SIREN / RCS / equiv."
          />
          <Field
            label="Juridiction"
            value={actor.pays}
            onChange={(e) => set({ pays: e.target.value })}
            placeholder="France"
            hint="Risque-pays GAFI dérivé automatiquement."
          />
        </div>
      )}

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
