/*
  Persistance 100 % locale.
  Version web : localStorage. Version desktop (Tauri) : à remplacer par
  un store chiffré / SQLite local (voir README, phase desktop).
  Aucune écriture réseau ici, par conception.
*/

import type { Dossier, Settings } from "./types";

const KEY_SETTINGS = "provenance.settings.v2";
const KEY_HISTORY = "provenance.history.v3";

const DEFAULT_SETTINGS: Settings = {
  fournisseur: "sanctions_io",
  apiKey: "",
  nomGalerie: "",
  signataire: "",
  seuilVigilanceEur: 10000,
  marcheFournisseur: "aucun",
  marcheApiKey: "",
  marcheEndpoint: "",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSettings(): Settings {
  if (!canUseStorage()) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

export function loadHistory(): Dossier[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as Dossier[];
  } catch {
    return [];
  }
}

export function saveDossier(dossier: Dossier): void {
  if (!canUseStorage()) return;
  const history = loadHistory();
  history.unshift(dossier);
  window.localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
}

export function deleteDossier(id: string): void {
  if (!canUseStorage()) return;
  const history = loadHistory().filter((d) => d.id !== id);
  window.localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
}

export function clearHistory(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(KEY_HISTORY);
}
