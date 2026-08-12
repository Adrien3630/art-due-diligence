"use client";

/*
  Verrouillage automatique après inactivité.

  Modèle de menace comblé : le poste de galerie laissé sans surveillance, coffre
  déverrouillé. Au-delà du délai configuré, on purge la clé de la mémoire
  (`lock()`) et l'écran de déverrouillage reprend la main.

  Purement local : un minuteur réarmé à chaque activité (throttlé). Aucun effet
  réseau. `minutes = 0` désactive le mécanisme.
*/

import { useEffect, useRef } from "react";

const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function AutoLock({
  minutes,
  onLock,
}: {
  minutes: number;
  onLock: () => void;
}) {
  const onLockRef = useRef(onLock);
  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    const delay = minutes * 60_000;
    let timer: ReturnType<typeof setTimeout>;
    let last = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onLockRef.current(), delay);
    };
    // Throttle : ne réarme au plus qu'une fois par seconde.
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 1000) {
        last = now;
        arm();
      }
    };
    // Verrouille aussi quand l'onglet reste caché au-delà du délai.
    const onVisibility = () => {
      if (document.visibilityState === "visible") arm();
    };

    arm();
    for (const ev of ACTIVITY) window.addEventListener(ev, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      for (const ev of ACTIVITY) window.removeEventListener(ev, onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [minutes]);

  return null;
}
