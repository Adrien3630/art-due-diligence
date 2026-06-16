"use client";

/*
  Panneau « Pièces à collecter » — résultat de l'approche par les risques.

  • Vigilance simplifiée  → aucune pièce : on l'affiche explicitement.
  • Standard / renforcée   → liste minimale, chaque pièce JUSTIFIÉE par un motif.
  Pour adoucir une demande inévitable : génération d'un courriel pré-rempli
  (copier / ouvrir dans la messagerie / télécharger). L'outil n'envoie rien.
*/

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  buildRequestLetter,
  downloadLetter,
  mailtoHref,
} from "@/lib/requestLetter";
import type { Actor, CollectionItem, Settings } from "@/lib/types";

export function CollectionPanel({
  actor,
  pieces,
  settings,
}: {
  actor: Actor;
  pieces: CollectionItem[];
  settings: Pick<Settings, "nomGalerie" | "signataire">;
}) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const draft = buildRequestLetter(actor, pieces, settings);

  if (pieces.length === 0) {
    return (
      <div className="rounded-md border border-risk-low/30 bg-risk-low-bg px-4 py-3">
        <p className="text-sm text-risk-low">
          <strong className="font-medium">Aucune pièce intrusive requise</strong> à
          ce stade. La vigilance simplifiée s'applique — inutile de solliciter le
          client.
        </p>
      </div>
    );
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Objet : ${draft.objet}\n\n${draft.corps}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <ul className="space-y-2">
        {pieces.map((p) => (
          <li
            key={p.id}
            className="rounded-md border border-line bg-surface-2 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <span className="text-gold">—</span>
              <div>
                <p className="text-sm text-ink">{p.label}</p>
                <p className="mt-0.5 text-[0.72rem] text-muted">{p.motif}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => setDraftOpen((v) => !v)}>
          {draftOpen ? "Masquer la demande" : "Générer la demande pré-remplie"}
        </Button>
        {draftOpen && (
          <>
            <a
              href={mailtoHref(draft)}
              className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
            >
              Ouvrir dans la messagerie
            </a>
            <button
              onClick={copyDraft}
              className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
            >
              {copied ? "✓ Copié" : "Copier"}
            </button>
            <button
              onClick={() => downloadLetter(draft, actor)}
              className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
            >
              Télécharger (.txt)
            </button>
          </>
        )}
      </div>

      {draftOpen && (
        <div className="mt-3 rounded-md border border-line bg-surface-2 p-4">
          <p className="mb-2 text-[0.72rem] text-muted">
            Objet : <span className="text-ink-soft">{draft.objet}</span>
          </p>
          <pre className="whitespace-pre-wrap font-sans text-[0.78rem] leading-relaxed text-ink-soft">
            {draft.corps}
          </pre>
        </div>
      )}
    </div>
  );
}
