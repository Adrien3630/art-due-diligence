"use client";

/*
  Affiche la piste d'audit chaînée et vérifie son intégrité (tamper-evident).
  Si la chaîne est intacte → « intégrité vérifiée » ; sinon → alerte.
*/

import { useEffect, useState } from "react";
import { AUDIT_LABEL, verifyTrail } from "@/lib/audit";
import type { AuditEvent } from "@/lib/types";

export function AuditTimeline({ trail }: { trail: AuditEvent[] }) {
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    verifyTrail(trail).then((ok) => alive && setValid(ok));
    return () => {
      alive = false;
    };
  }, [trail]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label-eyebrow">Journal d'audit ({trail.length})</span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.66rem] font-medium"
          style={
            valid === false
              ? { color: "var(--color-risk-high)", background: "var(--color-risk-high-bg)" }
              : { color: "var(--color-risk-low)", background: "var(--color-risk-low-bg)" }
          }
        >
          {valid === null
            ? "vérification…"
            : valid
              ? "✓ intégrité vérifiée"
              : "⚠ chaîne altérée"}
        </span>
      </div>
      <ol className="space-y-0">
        {trail.map((e) => (
          <li key={e.seq} className="flex gap-3 border-l border-line pl-3 pb-3 last:pb-0">
            <div className="-ml-[15px] mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[0.78rem] font-medium text-ink">
                  {AUDIT_LABEL[e.type]}
                </span>
                <span className="text-[0.68rem] text-muted">
                  {new Date(e.horodatage).toLocaleString("fr-FR")}
                </span>
              </div>
              <p className="text-[0.74rem] leading-snug text-ink-soft">{e.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
