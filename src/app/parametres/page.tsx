"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, SectionTitle } from "@/components/ui";
import { loadSettings, saveSettings } from "@/lib/storage";
import { exportBlob, importBlob } from "@/lib/vault";
import {
  GAFI_SNAPSHOT_DATE,
  gafiSnapshotAgeMonths,
  isGafiSnapshotStale,
} from "@/lib/jurisdictions";
import type { Settings } from "@/lib/types";

const FOURNISSEURS: { value: Settings["fournisseur"]; label: string; note: string }[] = [
  { value: "sanctions_io", label: "Sanctions.io", note: "OFAC, UE, ONU, HMT, PPE…" },
  { value: "opensanctions", label: "OpenSanctions", note: "Listes consolidées, PPE" },
  { value: "custom", label: "Autre (compatible Sanctions.io)", note: "Schéma identique" },
];

export default function ParametresPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  // Calculé au montage (client) pour éviter tout écart d'hydratation SSR.
  const [gafi, setGafi] = useState<{ stale: boolean; ageMois: number } | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setGafi({ stale: isGafiSnapshotStale(), ageMois: gafiSnapshotAgeMonths() });
  }, []);

  if (!settings) return null;

  const update = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };

  async function persist() {
    if (!settings) return;
    try {
      await saveSettings(settings);
      setSaved(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    }
  }

  async function exporter() {
    const blob = await exportBlob();
    if (!blob) {
      alert("Aucun coffre à exporter.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const file = new Blob([blob], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `provenance_sauvegarde_${stamp}.vault`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importer(file: File) {
    const text = await file.text();
    const pass = prompt("Phrase secrète de cette sauvegarde :");
    if (!pass) return;
    const ok = await importBlob(text, pass);
    if (ok) {
      alert("Sauvegarde importée. L'application va se recharger.");
      window.location.reload();
    } else {
      alert("Import impossible : fichier ou phrase secrète invalide.");
    }
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
        <SectionTitle eyebrow="Vigilance continue">Revue périodique</SectionTitle>
        <p className="-mt-3 mb-4 text-[0.78rem] leading-relaxed text-muted">
          Les listes de sanctions évoluent : un dossier doit être re-contrôlé
          périodiquement. Au-delà de cet intervalle, il est signalé « à revoir »
          dans l'historique (re-screening en un clic).
        </p>
        <div className="max-w-xs">
          <Field
            label="Intervalle de revue (mois)"
            type="number"
            inputMode="numeric"
            value={String(settings.revueIntervalleMois)}
            onChange={(e) =>
              update({ revueIntervalleMois: Math.max(1, Number(e.target.value) || 1) })
            }
            hint="Indicatif, à valider par un juriste. Défaut : 12 mois."
          />
        </div>
        <div className="mt-5">
          <Button onClick={persist}>{saved ? "✓ Enregistré" : "Enregistrer"}</Button>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionTitle eyebrow="Référentiel pays">Listes GAFI (juridictions à risque)</SectionTitle>
        <p className="-mt-3 mb-4 text-[0.78rem] leading-relaxed text-muted">
          Le risque-pays est dérivé automatiquement des listes GAFI (grise /
          noire). Ces listes sont figées dans l'outil et révisées par le GAFI à
          chaque plénière (~février / juin / octobre) : elles doivent être
          actualisées manuellement dans le code.
        </p>
        <div
          className={`rounded-md border p-3 text-[0.78rem] leading-relaxed ${
            gafi?.stale
              ? "border-risk-high/40 bg-risk-high-bg text-risk-high"
              : "border-risk-low/40 bg-risk-low-bg text-risk-low"
          }`}
        >
          {gafi?.stale ? (
            <>
              ⚠︎ <strong>Snapshot périmé</strong> — dernière mise à jour :{" "}
              {GAFI_SNAPSHOT_DATE} (il y a ~{gafi.ageMois} mois). Le GAFI a très
              probablement révisé ses listes depuis. Résultats risque-pays à
              vérifier manuellement et snapshot à actualiser.
            </>
          ) : (
            <>
              ✓ Snapshot à jour — dernière mise à jour : {GAFI_SNAPSHOT_DATE}
              {gafi ? ` (il y a ~${gafi.ageMois} mois)` : ""}.
            </>
          )}
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

      <Card className="mb-6">
        <SectionTitle eyebrow="Coffre chiffré">Sauvegarde & sécurité</SectionTitle>
        <p className="-mt-3 mb-4 text-[0.78rem] leading-relaxed text-muted">
          Vos données sont chiffrées (AES-GCM, clé dérivée de votre phrase secrète).
          Exportez une sauvegarde chiffrée à conserver hors de cet ordinateur —
          utile pour l'obligation de conservation (5 ans) et en cas de panne.
          L'import remplace le coffre actuel.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={exporter}>
            Exporter une sauvegarde chiffrée
          </Button>
          <label className="cursor-pointer rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft transition-all hover:border-gold hover:text-ink">
            Importer une sauvegarde
            <input
              type="file"
              accept=".vault,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importer(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-[0.7rem] leading-relaxed text-risk-mid">
          ⚠︎ La sauvegarde reste chiffrée : sans la phrase secrète correspondante,
          elle est illisible. Conservez la phrase séparément du fichier.
        </p>
      </Card>

      <Card>
        <SectionTitle eyebrow="Confidentialité">Zéro cloud</SectionTitle>
        <ul className="space-y-2 text-sm text-ink-soft">
          {[
            "Les identités, photos et rapports ne sont jamais envoyés sur un serveur tiers.",
            "Seul le nom des parties (screening) et le nom de l'artiste (marché, si activé) sont transmis à vos fournisseurs, avec vos propres clés.",
            "L'historique est chiffré (AES-GCM) dans le stockage local de cet appareil ; il se verrouille et peut être effacé à tout moment.",
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
