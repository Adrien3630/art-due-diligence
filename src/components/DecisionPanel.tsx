"use client";

/*
  Capture de la DÉCISION HUMAINE — l'outil assiste, le professionnel tranche.
  Quatre issues conformes à l'esprit LCB-FT. La décision est datée et signée ;
  elle conditionne l'archivage du dossier.
*/

import { useState } from "react";
import { Button } from "@/components/ui";
import type { DecisionType, HumanDecision } from "@/lib/types";

export const DECISION_LABEL: Record<DecisionType, string> = {
  poursuivre: "Poursuivre la relation",
  attente: "Mettre en attente",
  refuser: "Refuser l'opération",
  declaration: "Déclarer un soupçon (Tracfin)",
};

const OPTS: { v: DecisionType; tone: string }[] = [
  { v: "poursuivre", tone: "var(--color-risk-low)" },
  { v: "attente", tone: "var(--color-risk-mid)" },
  { v: "refuser", tone: "var(--color-risk-high)" },
  { v: "declaration", tone: "var(--color-risk-high)" },
];

export function DecisionPanel({
  decision,
  signataireDefaut,
  onSave,
}: {
  decision: HumanDecision | null;
  signataireDefaut: string;
  onSave: (d: HumanDecision) => void;
}) {
  const [type, setType] = useState<DecisionType | null>(decision?.type ?? null);
  const [motif, setMotif] = useState(decision?.motif ?? "");
  const [signataire, setSignataire] = useState(
    decision?.signataire || signataireDefaut,
  );

  function save() {
    if (!type) return;
    onSave({ type, motif, signataire, horodatage: new Date().toISOString() });
  }

  return (
    <div>
      {decision && (
        <div className="mb-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-[0.74rem] text-ink-soft">
          ✓ Décision enregistrée : <strong className="font-medium">{DECISION_LABEL[decision.type]}</strong>{" "}
          · {new Date(decision.horodatage).toLocaleString("fr-FR")}
          {decision.signataire ? ` · ${decision.signataire}` : ""}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {OPTS.map((o) => {
          const active = type === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => setType(o.v)}
              className="rounded-md border px-3 py-1.5 text-[0.78rem] transition-colors"
              style={
                active
                  ? { color: "#fff", background: o.tone, borderColor: o.tone }
                  : { color: o.tone, borderColor: "var(--color-line)" }
              }
            >
              {DECISION_LABEL[o.v]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="label-eyebrow mb-1.5 block">Motif de la décision</span>
          <textarea
            className="input-line min-h-[64px] resize-y"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Justification de la décision (tracée au dossier)"
          />
        </label>
        <label className="block sm:w-56">
          <span className="label-eyebrow mb-1.5 block">Signataire</span>
          <input
            className="input-line"
            value={signataire}
            onChange={(e) => setSignataire(e.target.value)}
            placeholder="Nom, qualité"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="ghost" onClick={save} disabled={!type}>
          {decision ? "Mettre à jour la décision" : "Enregistrer la décision"}
        </Button>
        {!type && (
          <span className="text-[0.72rem] text-muted">
            Sélectionnez une issue pour clôturer le dossier.
          </span>
        )}
      </div>
    </div>
  );
}
