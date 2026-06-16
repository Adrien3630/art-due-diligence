"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation : accueil, les trois analyses, l'historique et les réglages.
const TABS = [
  { href: "/", label: "Accueil", hint: "Choisir une analyse" },
  { href: "/acteur", label: "Acteur", hint: "Personne · entité" },
  { href: "/oeuvre", label: "Œuvre", hint: "Provenance" },
  { href: "/transaction", label: "Transaction", hint: "Dossier complet" },
  { href: "/historique", label: "Historique Local", hint: "Dossiers clôturés" },
  { href: "/parametres", label: "Paramètres", hint: "Clé API · confidentialité" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-surface-2 flex flex-col">
      {/* Marque */}
      <div className="px-7 pt-8 pb-6">
        <div className="font-serif text-[1.6rem] leading-none text-ink tracking-tight">
          Provenance
        </div>
        <div className="rule-gold mt-3 mb-3 w-12" />
        <p className="text-[0.7rem] leading-relaxed text-muted">
          Vigilance LCB-FT
          <br />
          pour le marché de l'art
        </p>
      </div>

      {/* Navigation */}
      <nav className="px-4 flex flex-col gap-1">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "group rounded-md px-3 py-2.5 transition-colors",
                active
                  ? "bg-surface border border-line shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  : "border border-transparent hover:bg-surface/60",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={[
                    "h-4 w-[2px] rounded-full transition-colors",
                    active ? "bg-gold" : "bg-transparent group-hover:bg-line-strong",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-[0.92rem]",
                    active ? "text-ink font-medium" : "text-ink-soft",
                  ].join(" ")}
                >
                  {tab.label}
                </span>
              </div>
              <span className="block pl-[18px] text-[0.7rem] text-muted mt-0.5">
                {tab.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Pied : promesse de confidentialité */}
      <div className="mt-auto px-7 py-6 border-t border-line">
        <div className="flex items-center gap-2 text-[0.7rem] text-ink-soft">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-risk-low"
            aria-hidden
          />
          100 % local · aucun cloud
        </div>
        <p className="mt-2 text-[0.66rem] leading-relaxed text-muted">
          Les données saisies ne quittent jamais cet ordinateur, hormis l'appel
          de screening vers votre fournisseur.
        </p>
      </div>
    </aside>
  );
}
