"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, SectionTitle } from "@/components/ui";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/types";

const FOURNISSEURS: { value: Settings["fournisseur"]; label: string; note: string }[] = [
  { value: "sanctions_io", label: "Sanctions.io", note: "OFAC, UE, ONU, HMT, PPE…" },
  { value: "opensanctions", label: "OpenSanctions", note: "Listes consolidées, PPE" },
  { value: "custom", label: "Autre (compatible Sanctions.io)", note: "Schéma identique" },
];

export default function ParametresPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  if (!settings) return null;

  const update = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };

  function persist() {
    if (!settings) return;
    saveSettings(settings);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <header className="mb-8">
        <div className="label-eyebrow mb-1">Configuration locale</div>
        <h1 className="font-serif text-3xl text-ink">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">
          Tout est stocké sur cet ordinateur. Les seules sorties réseau sont
          l'interrogation de votre fournisseur de screening (nom des parties) et,
          si configuré, de votre fournisseur de marché (nom de l'artiste).
        </p>
      </header>

      <Card className="mb-6">
        <SectionTitle eyebrow="Identité du rapport">Votre galerie</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Nom de la galerie"
            value={settings.nomGalerie}
            onChange={(e) => update({ nomGalerie: e.target.value })}
            placeholder="Galerie —"
          />
          <Field
            label="Signataire par défaut"
            value={settings.signataire}
            onChange={(e) => update({ signataire: e.target.value })}
            placeholder="Nom, qualité"
          />
        </div>
      </Card>

      <Card className="mb-6">
        <SectionTitle eyebrow="Screening de sanctions">
          Fournisseur & clé API
        </SectionTitle>

        <label className="block">
          <span className="label-eyebrow block mb-1.5">Fournisseur</span>
          <select
            className="input-line"
            value={settings.fournisseur}
            onChange={(e) =>
              update({ fournisseur: e.target.value as Settings["fournisseur"] })
            }
          >
            {FOURNISSEURS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} — {f.note}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <Field
            label="Clé API"
            type="password"
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder="Collez votre clé ici"
            hint="Conservée localement. Sans clé, le screening reste en mode démonstration (non probant)."
          />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Button onClick={persist}>{saved ? "✓ Enregistré" : "Enregistrer"}</Button>
          <span
            className={`text-[0.72rem] ${settings.apiKey ? "text-risk-low" : "text-risk-mid"}`}
          >
            {settings.apiKey
              ? "Clé configurée — screening réel actif."
              : "Aucune clé — mode démonstration."}
          </span>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionTitle eyebrow="Données de marché (optionnel)">
          Cote & comparables d'enchères
        </SectionTitle>
        <p className="-mt-3 mb-4 text-[0.78rem] leading-relaxed text-muted">
          Permet d'objectiver l'indicateur « prix incohérent » avec de vrais
          comparables d'enchères. Les fournisseurs sérieux (Artnet, Artprice) sont
          payants. Sans configuration, cette vérification reste en démonstration
          (non probante) et l'indicateur prix s'apprécie manuellement.
        </p>

        <label className="block">
          <span className="label-eyebrow block mb-1.5">Fournisseur</span>
          <select
            className="input-line"
            value={settings.marcheFournisseur}
            onChange={(e) =>
              update({ marcheFournisseur: e.target.value as Settings["marcheFournisseur"] })
            }
          >
            <option value="aucun">Aucun — indicateur prix à jugement humain</option>
            <option value="artnet">Artnet (abonnement payant)</option>
            <option value="custom">Autre service REST (contrat documenté)</option>
          </select>
        </label>

        {settings.marcheFournisseur !== "aucun" && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="URL de l'API"
              value={settings.marcheEndpoint}
              onChange={(e) => update({ marcheEndpoint: e.target.value })}
              placeholder="https://api.fournisseur.com/auction-results"
              hint="Endpoint REST renvoyant les résultats d'enchères (voir contrat dans api/market)."
            />
            <Field
              label="Clé API marché"
              type="password"
              value={settings.marcheApiKey}
              onChange={(e) => update({ marcheApiKey: e.target.value })}
              placeholder="Collez votre clé ici"
              hint="Conservée localement. Distincte de la clé de screening."
            />
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <Button onClick={persist}>{saved ? "✓ Enregistré" : "Enregistrer"}</Button>
          <span
            className={`text-[0.72rem] ${
              settings.marcheFournisseur !== "aucun" && settings.marcheApiKey
                ? "text-risk-low"
                : "text-risk-mid"
            }`}
          >
            {settings.marcheFournisseur !== "aucun" && settings.marcheApiKey
              ? "Fournisseur configuré — comparables réels actifs."
              : "Aucun fournisseur — mode démonstration."}
          </span>
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Confidentialité">Zéro cloud</SectionTitle>
        <ul className="space-y-2 text-sm text-ink-soft">
          {[
            "Les identités, photos et rapports ne sont jamais envoyés sur un serveur tiers.",
            "Seul le nom des parties (screening) et le nom de l'artiste (marché, si activé) sont transmis à vos fournisseurs, avec vos propres clés.",
            "L'historique réside dans le stockage local de cet appareil et peut être effacé à tout moment.",
            "Aucune télémétrie, aucun traceur, aucun compte requis.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gold">—</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
