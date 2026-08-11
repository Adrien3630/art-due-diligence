/*
  Route de DONNÉES DE MARCHÉ — comparables d'enchères pour la cote d'un artiste.
  Exécutée côté serveur ; relaie vers le fournisseur de la galerie avec SA clé.
  Aucune donnée conservée ici.

  ── Honnêteté du produit ───────────────────────────────────────────────
  • Aucun fournisseur configuré → mode DÉMONSTRATION explicite, « non probant ».
    On ne fait jamais passer des comparables fictifs pour des données réelles.
  • Avec fournisseur → appel réel ; en cas d'échec, statut `error` (jamais une
    fausse fourchette rassurante).

  ── « Prêt à brancher » plutôt que « API inventée » ────────────────────
  Les fournisseurs sérieux (Artnet, Artprice) sont payants et leur API est
  privée/sous accord — on NE code donc PAS en dur un endpoint deviné. On expose
  un CONNECTEUR REST GÉNÉRIQUE : la galerie renseigne l'URL de base et la clé.
  Le contrat attendu (à adapter via une fine couche d'adaptation le jour où l'on
  a la doc exacte d'Artnet) :

      GET {endpoint}?artist={nom}&currency=EUR
      Authorization: Bearer {clé}
      → 200 {
          "results": [
            { "title": "...", "sale_date": "2023-11-14",
              "auction_house": "...", "price_eur": 42000, "source": "https://..." },
            ...
          ]
        }

  ── Note Tauri (phase desktop) ─────────────────────────────────────────
  Cette logique migrera côté Rust (commande Tauri) ou via plugin-http. Le
  contrat d'E/S reste identique.
*/

import { NextResponse } from "next/server";
import type {
  MarketComparable,
  MarketResult,
  Settings,
} from "@/lib/types";

interface MarketRequest {
  artiste: string;
  settings: Pick<Settings, "marcheFournisseur" | "marcheApiKey" | "marcheEndpoint">;
}

/** Calcule la fourchette (min / max / médiane) à partir des comparables. */
function fourchette(
  comps: MarketComparable[],
): MarketResult["fourchetteEur"] {
  const prix = comps
    .map((c) => c.prixEur)
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (prix.length === 0) return null;
  const mid = Math.floor(prix.length / 2);
  const mediane =
    prix.length % 2 === 0 ? (prix[mid - 1] + prix[mid]) / 2 : prix[mid];
  return { min: prix[0], max: prix[prix.length - 1], mediane };
}

// ── Mode démonstration (aucun fournisseur) ──────────────────────────────
function demoResult(artiste: string): MarketResult {
  // Comparables purement illustratifs, clairement étiquetés non probants.
  const comparables: MarketComparable[] = artiste.trim()
    ? [
        { titre: "EXEMPLE — lot illustratif", date: "2023", maison: "EXEMPLE", prixEur: 18000 },
        { titre: "EXEMPLE — lot illustratif", date: "2022", maison: "EXEMPLE", prixEur: 42000 },
        { titre: "EXEMPLE — lot illustratif", date: "2021", maison: "EXEMPLE", prixEur: 67000 },
      ]
    : [];
  return {
    artiste,
    status: "demo",
    comparables,
    fourchetteEur: fourchette(comparables),
    fournisseur: "Aucun (démonstration)",
    horodatage: new Date().toISOString(),
    message:
      "MODE DÉMONSTRATION — aucun fournisseur de marché configuré. Ces comparables " +
      "sont fictifs et NON PROBANTS. Renseignez un fournisseur dans Paramètres.",
  };
}

// ── Connecteur REST générique (Artnet / custom) ─────────────────────────
async function callRestProvider(
  artiste: string,
  endpoint: string,
  apiKey: string,
  fournisseur: string,
): Promise<MarketResult> {
  const url = new URL(endpoint);
  url.searchParams.set("artist", artiste);
  url.searchParams.set("currency", "EUR");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${fournisseur} a répondu ${res.status}`);

  const data = (await res.json()) as {
    results?: {
      title?: string;
      sale_date?: string;
      auction_house?: string;
      price_eur?: number;
      source?: string;
    }[];
  };

  const comparables: MarketComparable[] = (data.results ?? []).map((r) => ({
    titre: String(r.title ?? "—"),
    date: String(r.sale_date ?? "—"),
    maison: String(r.auction_house ?? "—"),
    prixEur: Math.round(Number(r.price_eur ?? 0)),
    source: r.source ? String(r.source) : undefined,
  }));

  return {
    artiste,
    status: comparables.length >= 3 ? "ok" : "insufficient",
    comparables,
    fourchetteEur: fourchette(comparables),
    fournisseur,
    horodatage: new Date().toISOString(),
    message:
      comparables.length < 3
        ? "Trop peu de comparables pour une fourchette fiable — à apprécier manuellement."
        : undefined,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let body: MarketRequest;
  try {
    body = (await request.json()) as MarketRequest;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { artiste, settings } = body;
  if (!artiste?.trim()) {
    return NextResponse.json({ error: "Artiste non renseigné." }, { status: 400 });
  }

  // Pas de fournisseur, pas de clé ou pas d'endpoint → démonstration honnête.
  if (
    !settings?.marcheFournisseur ||
    settings.marcheFournisseur === "aucun" ||
    !settings.marcheApiKey ||
    !settings.marcheEndpoint
  ) {
    return NextResponse.json(demoResult(artiste));
  }

  try {
    const label = settings.marcheFournisseur === "artnet" ? "Artnet" : "Fournisseur marché";
    const result = await callRestProvider(
      artiste,
      settings.marcheEndpoint,
      settings.marcheApiKey,
      label,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    const errorResult: MarketResult = {
      artiste,
      status: "error",
      comparables: [],
      fourchetteEur: null,
      fournisseur: settings.marcheFournisseur,
      horodatage: new Date().toISOString(),
      message: `Interrogation du marché non aboutie : ${message}`,
    };
    // 200 volontaire : l'UI gère un statut `error` métier, pas un crash.
    return NextResponse.json(errorResult);
  }
}
