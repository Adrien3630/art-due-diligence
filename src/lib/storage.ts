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

/**
 * Enregistre un dossier : le remplace s'il existe déjà (réouverture), sinon
 * l'ajoute en tête. Évite les doublons lors d'une ré-archive.
 */
export async function upsertDossier(dossier: Dossier): Promise<void> {
  const c = getContent();
  if (!c) return;
  c.history = c.history.some((d) => d.id === dossier.id)
    ? c.history.map((d) => (d.id === dossier.id ? dossier : d))
    : [dossier, ...c.history];
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

/* ── Brouillons (auto-save chiffré, #2) ─────────────────────────────── */

/** Lit un brouillon de saisie en cours (null si aucun). */
export function loadDraft<T>(key: string): T | null {
  const c = getContent();
  return (c?.drafts?.[key] as T | undefined) ?? null;
}

let draftTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Enregistre un brouillon dans le coffre chiffré, avec anti-rebond (600 ms) pour
 * ne pas re-chiffrer à chaque frappe. Silencieux : les échecs (quota) sont
 * absorbés — le brouillon est un confort, pas la source de vérité.
 */
export function saveDraftDebounced(key: string, value: unknown): void {
  const c = getContent();
  if (!c) return;
  c.drafts = { ...(c.drafts ?? {}), [key]: value };
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    persist().catch(() => {});
  }, 600);
}

/** Efface un brouillon (dossier créé, réinitialisation). */
export async function clearDraft(key: string): Promise<void> {
  const c = getContent();
  if (!c?.drafts || !(key in c.drafts)) return;
  delete c.drafts[key];
  await persist();
}
