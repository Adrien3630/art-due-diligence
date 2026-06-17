/*
  Vigilance continue — re-screening dans le temps.

  La LCB-FT impose une vigilance CONSTANTE : les listes de sanctions / PPE
  évoluent, un sujet « clear » aujourd'hui peut être visé demain. Ce module :
   • détermine quels dossiers sont « à revoir » (ancienneté > intervalle) ;
   • re-screene un dossier archivé, recalcule sa synthèse, détecte les
     changements de statut et les consigne dans la piste d'audit.

  Les fonctions d'ancienneté sont PURES (testables, `now` injecté). L'orchestration
  de re-screening réutilise la même logique que les écrans d'analyse — rien de
  réinventé.
*/

import { appendEvent } from "./audit";
import {
  collectBeneficiarySubjects,
  runScreening,
  subjectFromActor,
  type ScreeningCred,
} from "./screening";
import { aggregateTransaction, assessActor } from "./scoring";
import type {
  Actor,
  Dossier,
  ScreeningResult,
  ScreeningStatus,
  Settings,
  TransactionParty,
} from "./types";

/* ── Ancienneté (pur) ───────────────────────────────────────────────── */

/** Date de la dernière revue effective (re-screening sinon création). */
export function lastReviewDate(d: Dossier): string {
  return d.derniereRevue ?? d.date;
}

/** Le re-screening a-t-il un sens pour ce dossier ? (l'œuvre n'a pas d'acteur) */
export function isVigilanceApplicable(d: Dossier): boolean {
  return d.kind === "acteur" || d.kind === "transaction";
}

/** Nombre de mois entiers écoulés entre deux dates ISO. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Le dossier est-il à revoir (ancienneté ≥ intervalle) ? */
export function vigilanceDue(
  d: Dossier,
  intervalleMois: number,
  nowIso: string,
): boolean {
  if (!isVigilanceApplicable(d)) return false;
  return monthsBetween(lastReviewDate(d), nowIso) >= intervalleMois;
}

/* ── Re-screening (orchestration réseau) ────────────────────────────── */

// Sévérité d'un statut, pour détecter une aggravation.
const RANK: Record<ScreeningStatus, number> = {
  clear: 0,
  demo: 0,
  error: 0,
  media: 1,
  ppe: 2,
  sanction: 3,
};

export interface RescreenOutcome {
  dossier: Dossier;
  changements: string[]; // ex. "Acheteur : aucune correspondance → sanction"
  aggrave: boolean; // au moins un statut s'est aggravé
}

const STATUS_LABEL: Record<ScreeningStatus, string> = {
  clear: "aucune correspondance",
  ppe: "PPE",
  sanction: "sanction",
  media: "média négatif",
  error: "screening non abouti",
  demo: "démonstration",
};

function diff(
  label: string,
  before: ScreeningStatus,
  after: ScreeningStatus,
  changements: string[],
): boolean {
  if (before === after) return false;
  changements.push(`${label} : ${STATUS_LABEL[before]} → ${STATUS_LABEL[after]}`);
  return RANK[after] > RANK[before];
}

async function rescreenParty(
  actor: Actor,
  cred: ScreeningCred,
  ctx: { seuilVigilanceEur: number; montantEur: number | null },
): Promise<Pick<TransactionParty, "screening" | "beneficiairesScreening" | "assessment">> {
  const screening = await runScreening(subjectFromActor(actor), cred);
  const beneficiairesScreening: ScreeningResult[] =
    actor.kind === "entite"
      ? await Promise.all(
          collectBeneficiarySubjects(actor.beneficiaires).map((s) => runScreening(s, cred)),
        )
      : [];
  const assessment = assessActor(actor, screening, beneficiairesScreening, ctx);
  return { screening, beneficiairesScreening, assessment };
}

/**
 * Re-screene un dossier, recalcule sa synthèse, détecte les changements et les
 * journalise. Renvoie un NOUVEAU dossier (immutable) prêt à être ré-enregistré.
 */
export async function rescreenDossier(
  dossier: Dossier,
  settings: Settings,
): Promise<RescreenOutcome> {
  const cred: ScreeningCred = { fournisseur: settings.fournisseur, apiKey: settings.apiKey };
  const now = new Date().toISOString();
  const changements: string[] = [];
  let aggrave = false;

  let updated: Dossier;

  if (dossier.kind === "acteur") {
    const ctx = { seuilVigilanceEur: settings.seuilVigilanceEur, montantEur: null };
    const r = await rescreenParty(dossier.actor, cred, ctx);
    aggrave = diff("Acteur", dossier.screening.status, r.screening.status, changements) || aggrave;
    updated = { ...dossier, ...r, derniereRevue: now };
  } else if (dossier.kind === "transaction") {
    const ctx = { seuilVigilanceEur: settings.seuilVigilanceEur, montantEur: dossier.montantEur };
    const ach = await rescreenParty(dossier.acheteur.actor, cred, ctx);
    aggrave =
      diff("Acheteur", dossier.acheteur.screening.status, ach.screening.status, changements) ||
      aggrave;
    const acheteur: TransactionParty = { ...dossier.acheteur, ...ach };

    let vendeur = dossier.vendeur;
    if (dossier.vendeur) {
      const ven = await rescreenParty(dossier.vendeur.actor, cred, ctx);
      aggrave =
        diff("Vendeur", dossier.vendeur.screening.status, ven.screening.status, changements) ||
        aggrave;
      vendeur = { ...dossier.vendeur, ...ven };
    }

    const agg = aggregateTransaction({
      montantEur: dossier.montantEur,
      acheteur: acheteur.assessment,
      vendeur: vendeur?.assessment ?? null,
      oeuvre: dossier.oeuvre.assessment,
      comportement: dossier.comportement,
    });
    updated = {
      ...dossier,
      acheteur,
      vendeur,
      niveau: agg.niveau,
      facteurs: agg.facteurs,
      derniereRevue: now,
    };
  } else {
    // Œuvre : pas de re-screening possible (aucun acteur).
    return { dossier, changements: [], aggrave: false };
  }

  // Journalisation chaînée.
  let trail = await appendEvent(
    updated.auditTrail,
    "screening_lance",
    `Re-screening de vigilance continue (${settings.fournisseur})`,
  );
  trail = await appendEvent(
    trail,
    "screening_resultat",
    changements.length
      ? `Revue : changement(s) détecté(s) — ${changements.join(" ; ")}`
      : "Revue : aucun changement de statut.",
  );
  updated = { ...updated, auditTrail: trail };

  return { dossier: updated, changements, aggrave };
}
