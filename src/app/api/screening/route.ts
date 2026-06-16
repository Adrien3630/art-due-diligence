/*
  Route de screening de sanctions — exécutée côté serveur en dev web.
  Elle relaie la requête vers le VRAI fournisseur choisi par la galerie,
  avec SA clé API. Aucune donnée n'est conservée ici.

  ── Honnêteté du produit ───────────────────────────────────────────────
  • Sans clé API → mode DÉMONSTRATION explicite : le résultat est étiqueté
    « non probant ». On ne fait jamais passer une simulation pour un screening.
  • Avec clé → appel réel ; en cas d'échec, statut `error` (jamais un faux
    « clear » rassurant).
  • Précision : la date de naissance / nationalité sont transmises quand elles
    existent pour réduire les faux positifs (désambiguïsation).

  ── Note Tauri (phase desktop) ─────────────────────────────────────────
  En build statique Tauri, cette logique migre côté Rust (commande Tauri) ou
  via @tauri-apps/plugin-http. Le contrat d'E/S reste identique.
*/

import { NextResponse } from "next/server";
import { classifyMatches } from "@/lib/classify";
import type {
  ScreeningMatch,
  ScreeningResult,
  ScreeningSubject,
  Settings,
} from "@/lib/types";

interface ScreeningRequest {
  subject: ScreeningSubject;
  settings: Pick<Settings, "fournisseur" | "apiKey">;
}

function fullName(s: ScreeningSubject): string {
  return [s.prenoms, s.nom].filter(Boolean).join(" ").trim();
}

function isDesambiguise(s: ScreeningSubject): boolean {
  return Boolean(s.dateNaissance || s.nationalite);
}

// ── Mode démonstration (aucune clé) ────────────────────────────────────
function demoResult(s: ScreeningSubject): ScreeningResult {
  const name = fullName(s).toLowerCase();
  const matches: ScreeningMatch[] = [];
  // Déclencheurs purement illustratifs pour visualiser l'écran.
  if (name.includes("sanction") || name.includes("ppe")) {
    matches.push({
      nom: fullName(s),
      listes: ["EXEMPLE — non vérifié"],
      type: name.includes("ppe") ? "PEP (exemple)" : "Sanction (exemple)",
      score: 88,
    });
  }
  return {
    sujet: fullName(s),
    status: "demo",
    matches,
    listesInterrogees: [],
    fournisseur: "Aucun (démonstration)",
    horodatage: new Date().toISOString(),
    desambiguise: isDesambiguise(s),
    message:
      "MODE DÉMONSTRATION — aucune clé API configurée. Ce résultat est simulé " +
      "et NON PROBANT. Renseignez votre clé dans Paramètres pour un screening réel.",
  };
}

// ── Fournisseur : Sanctions.io ─────────────────────────────────────────
async function callSanctionsIo(
  s: ScreeningSubject,
  apiKey: string,
): Promise<ScreeningResult> {
  const url = new URL("https://api.sanctions.io/search/");
  url.searchParams.set("name", fullName(s));
  url.searchParams.set("min_score", "0.85");
  url.searchParams.set(
    "entity_type",
    s.kind === "entite" ? "entity" : "individual",
  );
  // Désambiguïsation best-effort selon l'abonnement (réduit les faux positifs).
  if (s.dateNaissance) url.searchParams.set("date_of_birth", s.dateNaissance);
  if (s.nationalite) url.searchParams.set("nationality", s.nationalite);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json; version=2.2",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Sanctions.io a répondu ${res.status}`);
  }

  const data: unknown = await res.json();
  const rawResults: Record<string, unknown>[] =
    (data as { results?: Record<string, unknown>[] })?.results ?? [];

  const matches: ScreeningMatch[] = rawResults.map((r) => ({
    nom: String(r.name ?? fullName(s)),
    listes: Array.isArray(r.data_source)
      ? (r.data_source as string[])
      : [String(r.source ?? r.data_source ?? "—")],
    type: String(r.entity_type ?? r.type ?? "—"),
    score: Math.round(Number(r.score ?? 0) * 100) / 100,
    pays: r.nationality ? String(r.nationality) : undefined,
  }));

  return classify(matches, "Sanctions.io", s);
}

// ── Fournisseur : OpenSanctions ────────────────────────────────────────
async function callOpenSanctions(
  s: ScreeningSubject,
  apiKey: string,
): Promise<ScreeningResult> {
  const url = new URL("https://api.opensanctions.org/search/default");
  url.searchParams.set("q", fullName(s));
  url.searchParams.set("limit", "10");
  url.searchParams.set(
    "schema",
    s.kind === "entite" ? "Organization" : "Person",
  );

  const res = await fetch(url, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OpenSanctions a répondu ${res.status}`);
  }

  const data = (await res.json()) as {
    results?: {
      caption?: string;
      schema?: string;
      datasets?: string[];
      properties?: { topics?: string[] };
      score?: number;
    }[];
  };

  const matches: ScreeningMatch[] = (data.results ?? []).map((r) => {
    const topics = r.properties?.topics ?? [];
    const type = topics.includes("sanction")
      ? "Sanction"
      : topics.some((t) => t.startsWith("role.pep"))
        ? "PEP"
        : (r.schema ?? "Entité");
    return {
      nom: r.caption ?? fullName(s),
      listes: r.datasets ?? [],
      type,
      score: Math.round((r.score ?? 0) * 100),
    };
  });

  return classify(matches, "OpenSanctions", s);
}

// ── Classification commune ─────────────────────────────────────────────
function classify(
  matches: ScreeningMatch[],
  fournisseur: string,
  s: ScreeningSubject,
): ScreeningResult {
  return {
    sujet: fullName(s),
    status: classifyMatches(matches),
    matches,
    listesInterrogees: [...new Set(matches.flatMap((m) => m.listes))],
    fournisseur,
    horodatage: new Date().toISOString(),
    desambiguise: isDesambiguise(s),
  };
}

// ── Handler ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let body: ScreeningRequest;
  try {
    body = (await request.json()) as ScreeningRequest;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const { subject, settings } = body;
  if (!subject?.nom) {
    return NextResponse.json(
      { error: "Identité incomplète." },
      { status: 400 },
    );
  }

  // Sans clé : démonstration honnête.
  if (!settings?.apiKey) {
    return NextResponse.json(demoResult(subject));
  }

  try {
    let result: ScreeningResult;
    switch (settings.fournisseur) {
      case "opensanctions":
        result = await callOpenSanctions(subject, settings.apiKey);
        break;
      case "sanctions_io":
      case "custom":
      default:
        result = await callSanctionsIo(subject, settings.apiKey);
        break;
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    const errorResult: ScreeningResult = {
      sujet: fullName(subject),
      status: "error",
      matches: [],
      listesInterrogees: [],
      fournisseur: settings.fournisseur,
      horodatage: new Date().toISOString(),
      desambiguise: isDesambiguise(subject),
      message: `Screening non abouti : ${message}`,
    };
    // 200 volontaire : l'UI gère un statut `error` métier, pas un crash.
    return NextResponse.json(errorResult);
  }
}
