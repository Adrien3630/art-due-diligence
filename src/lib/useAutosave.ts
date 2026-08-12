"use client";

/*
  Auto-save continu (#2) — persistance silencieuse d'un formulaire en cours dans
  le coffre chiffré. Restauration au montage via `loadDraft` (côté page). Le hook
  ci-dessous se charge de l'écriture anti-rebond ; il ignore le tout premier
  rendu pour ne pas écraser un brouillon restauré par l'état initial.
*/

import { useEffect, useRef } from "react";
import { saveDraftDebounced } from "./storage";

export function useAutosave<T>(key: string, value: T, enabled = true): void {
  const first = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    saveDraftDebounced(key, value);
  }, [key, value, enabled]);
}
