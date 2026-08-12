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

/**
 * Champ texte avec suggestions locales (datalist natif). Les valeurs viennent du
 * coffre de l'utilisateur — pur confort de saisie, aucune source externe (#7).
 */
export function AutoField({
  label,
  hint,
  suggestions = [],
  ...props
}: {
  label: string;
  hint?: string;
  suggestions?: string[];
} & InputHTMLAttributes<HTMLInputElement>) {
  const listId = `sugg-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <label className="block">
      <span className="label-eyebrow block mb-1.5">{label}</span>
      <input className="input-line" list={suggestions.length ? listId : undefined} {...props} />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {hint && <span className="mt-1 block text-[0.68rem] text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Jauge de complétion (#6). Barre + pourcentage + prochaine étape éventuelle.
 * Couleur graduée : rouge < 50 %, orange < 100 %, vert à 100 %.
 */
export function ProgressGauge({
  pct,
  nextStep,
  label = "Complétion du dossier",
}: {
  pct: number;
  nextStep?: string | null;
  label?: string;
}) {
  const color =
    pct >= 100
      ? "var(--color-risk-low)"
      : pct >= 50
        ? "var(--color-risk-mid)"
        : "var(--color-risk-high)";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-eyebrow">{label}</span>
        <span className="text-sm font-medium" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {nextStep && pct < 100 && (
        <p className="mt-1.5 text-[0.72rem] text-muted">
          Prochaine étape : <span className="text-ink-soft">{nextStep}</span>
        </p>
      )}
    </div>
  );
}

/** Alerte inline non-bloquante, ciblée (#5). */
export function InlineAlert({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "info" | "danger";
  children: ReactNode;
}) {
  const meta =
    tone === "danger"
      ? { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)" }
      : tone === "info"
        ? { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)" }
        : { color: "var(--color-risk-mid)", bg: "var(--color-risk-mid-bg)" };
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2 text-[0.76rem] leading-snug"
      style={{ color: meta.color, background: meta.bg }}
      role="status"
    >
      <span aria-hidden>▲</span>
      <span>{children}</span>
    </div>
  );
}

/** Modale légère (overlay plein écran). Rendue par un composant client (#3). */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-5xl" : "max-w-2xl"} rounded-lg border border-line bg-surface shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:text-ink"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

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
