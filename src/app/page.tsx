"use client";

/*
  Accueil — lanceur. Trois objets de due diligence, indépendants et combinables.
*/

import Link from "next/link";

const MODULES = [
  {
    href: "/acteur",
    eyebrow: "Personne ou entité",
    titre: "Vigilance acteur",
    desc: "Screening sanctions / PPE, risque-pays automatique, approche par les risques. L'outil ne réclame une pièce que si le risque l'exige.",
    glyph: "◑",
  },
  {
    href: "/oeuvre",
    eyebrow: "Provenance",
    titre: "Vigilance œuvre",
    desc: "Chaîne de provenance structurée, détection de trou 1933-1945, registres d'œuvres volées et spoliées, authenticité.",
    glyph: "❖",
  },
  {
    href: "/transaction",
    eyebrow: "Acheteur + vendeur + œuvre",
    titre: "Dossier transaction",
    desc: "Réunit les volets et agrège leurs synthèses, en ajoutant le risque transactionnel (espèces, paiement par un tiers, urgence).",
    glyph: "⬡",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-10 py-12">
      <header className="mb-10">
        <div className="label-eyebrow mb-1">Provenance — aide à la vigilance LCB-FT</div>
        <h1 className="font-serif text-4xl text-ink">Que souhaitez-vous vérifier ?</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Trois analyses distinctes. Vérifiez un acteur seul, une œuvre seule, ou
          réunissez les deux dans un dossier de transaction. Tout reste local —
          seul le nom des parties est transmis à votre fournisseur de screening.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex flex-col rounded-lg border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(23,20,15,0.04)] transition-all hover:border-gold hover:shadow-[0_4px_16px_rgba(23,20,15,0.07)]"
          >
            <div className="font-serif text-4xl text-line-strong transition-colors group-hover:text-gold">
              {m.glyph}
            </div>
            <div className="label-eyebrow mt-4">{m.eyebrow}</div>
            <h2 className="mt-1 font-serif text-xl text-ink">{m.titre}</h2>
            <div className="rule-gold mt-2.5 w-12" />
            <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-soft">{m.desc}</p>
            <span className="mt-4 text-[0.78rem] text-gold opacity-0 transition-opacity group-hover:opacity-100">
              Commencer →
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-[0.72rem] leading-relaxed text-muted">
        Aide à la décision : cet outil documente et structure la vigilance, sans se
        substituer au jugement du professionnel assujetti ni certifier l'authenticité
        d'une œuvre. Les niveaux et seuils sont indicatifs et doivent être validés par
        un juriste.
      </p>
    </div>
  );
}
