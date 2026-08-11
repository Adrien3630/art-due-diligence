"use client";

/*
  Éditeur RÉCURSIF d'un bénéficiaire effectif (UBO).
  Un bénéficiaire peut être une personne physique OU une entité intermédiaire ;
  dans ce cas, il a sa propre liste de bénéficiaires → on remonte la chaîne de
  détention (cascade). Chaque nœud sera screené ; une entité sans bénéficiaire
  déclaré est un point de transparence.
*/

import { Field } from "@/components/ui";
import { emptyBeneficiary } from "@/lib/factories";
import type { ActorKind, BeneficialOwner } from "@/lib/types";

export function BeneficiaryEditor({
  value,
  onChange,
  onRemove,
  depth = 0,
}: {
  value: BeneficialOwner;
  onChange: (b: BeneficialOwner) => void;
  onRemove: () => void;
  depth?: number;
}) {
  const set = (patch: Partial<BeneficialOwner>) => onChange({ ...value, ...patch });

  return (
    <div
      className="rounded-md border border-line bg-surface-2 p-3"
      style={{ marginLeft: depth > 0 ? 12 : 0 }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {(["personne", "entite"] as ActorKind[]).map((k) => {
            const active = value.kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => set({ kind: k })}
                className={[
                  "px-3 py-1 text-[0.74rem] transition-colors",
                  active ? "bg-ink text-bg" : "bg-surface text-ink-soft hover:bg-surface-2",
                ].join(" ")}
              >
                {k === "personne" ? "Personne" : "Entité"}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[0.72rem] text-muted underline-offset-2 hover:text-risk-high hover:underline"
        >
          Retirer
        </button>
      </div>

      {value.kind === "personne" ? (
        <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-end gap-3">
          <Field label="Nom" value={value.nom} onChange={(e) => set({ nom: e.target.value })} />
          <Field label="Prénom(s)" value={value.prenoms} onChange={(e) => set({ prenoms: e.target.value })} />
          <Field label="Part %" value={value.pourcentage} onChange={(e) => set({ pourcentage: e.target.value })} placeholder="25" />
          <Field label="Nationalité" value={value.nationalite} onChange={(e) => set({ nationalite: e.target.value })} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-end gap-3">
            <Field label="Raison sociale" value={value.nom} onChange={(e) => set({ nom: e.target.value })} />
            <Field label="Forme juridique" value={value.formeJuridique} onChange={(e) => set({ formeJuridique: e.target.value })} />
            <Field label="Immatriculation" value={value.immatriculation} onChange={(e) => set({ immatriculation: e.target.value })} />
            <Field label="Part %" value={value.pourcentage} onChange={(e) => set({ pourcentage: e.target.value })} placeholder="25" />
          </div>

          <div className="mt-3 border-l-2 border-line-strong pl-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-eyebrow">Bénéficiaires de cette entité</span>
              <button
                type="button"
                onClick={() => set({ beneficiaires: [...value.beneficiaires, emptyBeneficiary()] })}
                className="text-[0.72rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
              >
                + Ajouter
              </button>
            </div>
            {value.beneficiaires.length === 0 ? (
              <p className="text-[0.72rem] text-muted">
                Aucun bénéficiaire déclaré — chaîne UBO incomplète (point de transparence).
              </p>
            ) : (
              <div className="space-y-3">
                {value.beneficiaires.map((b, i) => (
                  <BeneficiaryEditor
                    key={i}
                    value={b}
                    depth={depth + 1}
                    onChange={(nb) =>
                      set({
                        beneficiaires: value.beneficiaires.map((x, j) => (j === i ? nb : x)),
                      })
                    }
                    onRemove={() =>
                      set({ beneficiaires: value.beneficiaires.filter((_, j) => j !== i) })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
