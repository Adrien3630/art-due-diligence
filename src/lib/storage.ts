/*
  Persistance 100 % locale, désormais CHIFFRÉE (voir lib/vault.ts).

  Cette couche est une façade synchrone sur le cache mémoire du coffre :
   • les lectures (loadSettings/loadHistory) renvoient le cache déchiffré ;
   • les écritures re-chiffrent et persistent (asynchrone — peut lever
     StorageFullError si le stockage est plein).

  Tant que le coffre n'est pas déverrouillé, les lectures renvoient des valeurs
  par défaut vides (l'écran VaultGate empêche d'y arriver dans l'UI réelle).

  Aucune écriture réseau ici, par conception. Version desktop (Tauri) : le coffre
  migrera vers un store natif chiffré, contrat identique.
*/

import type { Dossier, Settings } from "./types";
import {
  DEFAULT_SETTINGS,
  getContent,
  persist,
} from "./vault";

export { DEFAULT_SETTINGS } from "./vault";

export function loadSettings(): Settings {
  return getContent()?.settings ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.settings = settings;
  await persist();
}

export function loadHistory(): Dossier[] {
  return getContent()?.history ?? [];
}

export async function saveDossier(dossier: Dossier): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.history.unshift(dossier);
  await persist();
}

/** Remplace un dossier existant (même id) — utilisé par le re-screening. */
export async function updateDossier(dossier: Dossier): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.history = c.history.map((d) => (d.id === dossier.id ? dossier : d));
  await persist();
}

export async function deleteDossier(id: string): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.history = c.history.filter((d) => d.id !== id);
  await persist();
}

export async function clearHistory(): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.history = [];
  await persist();
}
