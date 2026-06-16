/*
  Petites primitives d'interface, style « galerie ».
  Présentationnel : pas d'état, réutilisable partout.
*/

import type { InputHTMLAttributes, ReactNode } from "react";
import type { RiskLevel, ScreeningStatus, SubScore, VigilanceTier } from "@/lib/types";
import { RISK_META, TIER_META } from "@/lib/scoring";

/** Titre de section avec filet or. */
export function SectionTitle({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <div className="label-eyebrow mb-1.5">{eyebrow}</div>}
      <h2 className="font-serif text-xl text-ink leading-tight">{children}</h2>
      <div className="rule-gold mt-2.5 w-16" />
    </div>
  );
}

/** Champ texte libellé. */
export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label-eyebrow block mb-1.5">{label}</span>
      <input className="input-line" {...props} />
      {hint && <span className="mt-1 block text-[0.68rem] text-muted">{hint}</span>}
    </label>
  );
}

/** Bouton fin, deux variantes. */
export function Button({
  children,
  variant = "primary",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
} & InputHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-ink text-bg hover:bg-ink-soft active:translate-y-px"
      : "border border-line-strong text-ink-soft hover:border-gold hover:text-ink";
  return (
    <button className={`${base} ${styles}`} {...(props as object)}>
      {children}
    </button>
  );
}

/** Macaron de niveau de risque (Vert / Orange / Rouge). */
export function RiskBadge({
  niveau,
  size = "md",
}: {
  niveau: RiskLevel;
  size?: "sm" | "md";
}) {
  const meta = RISK_META[niveau];
  const pad = size === "sm" ? "px-2.5 py-1 text-[0.7rem]" : "px-3.5 py-1.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium ${pad}`}
      style={{ color: meta.color, background: meta.bg }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: meta.color }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

/** Carte / panneau de base. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(23,20,15,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Macaron du niveau de vigilance (approche par les risques). */
export function TierBadge({ tier }: { tier: VigilanceTier }) {
  const meta = TIER_META[tier];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium"
      style={{ color: meta.color, background: meta.bg }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: meta.color }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

/** Liste de sous-scores explicables (une ligne par catégorie). */
export function SubScores({ scores }: { scores: SubScore[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {scores.map((s) => {
        const meta = RISK_META[s.niveau];
        return (
          <div
            key={s.categorie}
            className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2"
          >
            <span className="text-[0.8rem] text-ink-soft">{s.categorie}</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.66rem] font-medium"
              style={{ color: meta.color, background: meta.bg }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color }}
                aria-hidden
              />
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Métadonnées des statuts de screening (libellé + couleurs). */
export const STATUS_PILL: Record<
  ScreeningStatus,
  { label: string; color: string; bg: string }
> = {
  clear: { label: "Aucune correspondance", color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)" },
  ppe: { label: "PPE", color: "var(--color-risk-mid)", bg: "var(--color-risk-mid-bg)" },
  media: { label: "Média négatif", color: "var(--color-risk-mid)", bg: "var(--color-risk-mid-bg)" },
  sanction: { label: "Sanction", color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" },
  error: { label: "Non abouti", color: "var(--color-muted)", bg: "var(--color-surface-2)" },
  demo: { label: "Démonstration", color: "var(--color-muted)", bg: "var(--color-surface-2)" },
};

/** Select libellé, même grammaire visuelle que Field. */
export function SelectField({
  label,
  children,
  value,
  onChange,
}: {
  label: string;
  children: ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="label-eyebrow block mb-1.5">{label}</span>
      <select
        className="input-line"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
