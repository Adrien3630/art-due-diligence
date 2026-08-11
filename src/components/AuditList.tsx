"use client";

/*
  Liste de questions tri-état (Oui / Non / Non renseigné).
  Réutilisée par : indices de vigilance acteur, checklist œuvre, comportement
  transactionnel. Présentationnel — l'état vit chez le parent.
*/

import type { AuditAnswer } from "@/lib/types";

function AuditRow({
  answer,
  onChange,
}: {
  answer: AuditAnswer;
  onChange: (reponse: boolean | null) => void;
}) {
  const flagged = answer.reponse !== null && answer.reponse === answer.flagValue;
  const opts: { v: boolean | null; label: string }[] = [
    { v: true, label: "Oui" },
    { v: false, label: "Non" },
    { v: null, label: "N/R" },
  ];
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <p className={`text-sm leading-snug ${flagged ? "text-ink" : "text-ink-soft"}`}>
        {answer.question}
        {flagged && (
          <span className="ml-2 align-middle text-[0.62rem] font-medium uppercase tracking-wide text-risk-mid">
            • vigilance
          </span>
        )}
      </p>
      <div className="flex shrink-0 overflow-hidden rounded-md border border-line">
        {opts.map((o) => {
          const active = answer.reponse === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={[
                "px-3 py-1.5 text-xs transition-colors",
                active ? "bg-ink text-bg" : "bg-surface text-ink-soft hover:bg-surface-2",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AuditList({
  answers,
  onChange,
}: {
  answers: AuditAnswer[];
  onChange: (next: AuditAnswer[]) => void;
}) {
  return (
    <div>
      {answers.map((a, i) => (
        <AuditRow
          key={a.id}
          answer={a}
          onChange={(rep) =>
            onChange(answers.map((x, j) => (j === i ? { ...x, reponse: rep } : x)))
          }
        />
      ))}
    </div>
  );
}
