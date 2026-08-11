/*
  GEL DES AVOIRS — obligation distincte de la déclaration de soupçon (Tracfin).

  Lorsqu'un screening renvoie une correspondance de SANCTION, la loi impose, si
  la personne figure bien sur une liste de gel applicable en France, une mesure
  de gel APPLICABLE SANS DÉLAI (art. L. 562-4 du Code monétaire et financier) :
   • ne pas mettre à disposition de fonds ni de ressources économiques ;
   • signaler sans délai à la Direction générale du Trésor.

  HONNÊTETÉ : le screening SIGNALE une correspondance possible — il ne prouve pas
  que la personne est sous gel en France (la liste du fournisseur peut être plus
  large : OFAC seul, homonyme…). L'outil renvoie donc D'ABORD au registre national
  officiel pour CONFIRMER, puis aide à préparer la notification. Il n'envoie rien.
*/

import type { Dossier, ScreeningResult, Settings } from "./types";

/** Registre national des gels (DG Trésor) — pour confirmer la correspondance. */
export const REGISTRE_GELS_URL = "https://gels-avoirs.dgtresor.gouv.fr/";
/** Contact DG Trésor pour le gel des avoirs. */
export const DGTRESOR_EMAIL = "sanctions-gel-avoirs@dgtresor.gouv.fr";

export interface FreezeHit {
  sujet: string;
  listes: string[]; // listes de sanctions concernées (correspondances non écartées)
}

/** Tous les résultats de screening rattachés à un dossier, quel que soit le type. */
function screeningsOf(dossier: Dossier): ScreeningResult[] {
  if (dossier.kind === "acteur") {
    return [dossier.screening, ...dossier.beneficiairesScreening];
  }
  if (dossier.kind === "transaction") {
    // Seules les parties présentes selon le mode (acheteur et/ou vendeur).
    return [dossier.acheteur, dossier.vendeur]
      .filter((p): p is NonNullable<typeof p> => p != null)
      .flatMap((p) => [p.screening, ...p.beneficiairesScreening]);
  }
  return []; // œuvre : aucun acteur screené
}

/** Sujets en correspondance de sanction (faux positifs écartés exclus). */
export function freezeHits(dossier: Dossier): FreezeHit[] {
  return screeningsOf(dossier)
    .filter((r) => r.status === "sanction")
    .map((r) => ({
      sujet: r.sujet,
      listes: [
        ...new Set(
          r.matches
            .filter((m) => !m.ecarte)
            .flatMap((m) => m.listes),
        ),
      ],
    }));
}

export function hasFreezeObligation(dossier: Dossier): boolean {
  return freezeHits(dossier).length > 0;
}

export interface FreezeNotice {
  objet: string;
  corps: string;
}

/** Projet de notification de gel des avoirs à la DG Trésor (jamais transmis). */
export function buildFreezeNotice(
  dossier: Dossier,
  settings: Pick<Settings, "nomGalerie" | "signataire">,
): FreezeNotice {
  const galerie = settings.nomGalerie?.trim() || "[Nom de la galerie]";
  const signataire = settings.signataire?.trim() || "[Déclarant — nom et qualité]";
  const hits = freezeHits(dossier);
  const date = new Date(dossier.date).toLocaleString("fr-FR");

  const personnes = hits
    .map(
      (h) =>
        `  • ${h.sujet}${h.listes.length ? ` — liste(s) : ${h.listes.join(", ")}` : ""}`,
    )
    .join("\n");

  const objet = `PROJET de signalement — gel des avoirs — dossier ${dossier.id}`;

  const corps = `PROJET DE SIGNALEMENT — GEL DES AVOIRS
À confirmer dans le registre national des gels, puis transmettre à la
Direction générale du Trésor.

⚠️ AVANT TOUT : vérifiez la correspondance dans le registre national des gels
(${REGISTRE_GELS_URL}). Une correspondance de screening n'établit pas à elle
seule un gel applicable en France (liste plus large, homonyme possible).

Si la correspondance est confirmée, la mesure de gel est APPLICABLE SANS DÉLAI
(art. L. 562-4 du Code monétaire et financier) :
  – ne mettez à disposition aucun fonds ni ressource économique ;
  – ne finalisez pas l'opération ;
  – signalez sans délai à la Direction générale du Trésor
    (${DGTRESOR_EMAIL}).

Référence dossier : ${dossier.id}
Date d'établissement : ${date}

I. DÉCLARANT
${galerie}
Personne responsable : ${signataire}

II. PERSONNE(S) EN CORRESPONDANCE DE SANCTION
${personnes || "  • (aucune — vérifiez le statut du screening)"}

III. OPÉRATION CONCERNÉE
Relation d'affaires / opération sur le marché de l'art — réf. dossier ${dossier.id}.

IV. MESURES PRISES
  – Opération suspendue dans l'attente de la vérification du registre.
  – (à compléter : gel effectif, comptes/biens concernés, montants…)

— Document de travail généré localement. Sans valeur tant qu'il n'est pas
vérifié puis transmis par le déclarant à la DG Trésor.`;

  return { objet, corps };
}

/** Télécharge le projet de signalement en fichier texte local. */
export function downloadFreezeNotice(notice: FreezeNotice, dossier: Dossier): void {
  const content = `${notice.objet}\n\n${notice.corps}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `projet_gel_avoirs_${dossier.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
