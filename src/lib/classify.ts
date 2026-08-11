/*
  Classification d'un statut de screening à partir des correspondances.

  Source UNIQUE de cette heuristique, partagée par :
   • la route /api/screening (statut initial) ;
   • le recalcul après qu'un faux positif a été écarté (côté client).

  Les correspondances marquées « écartées » (faux positifs) sont exclues.
*/

import type { ScreeningMatch } from "./types";

export type MatchStatus = "clear" | "ppe" | "sanction" | "media";

export function classifyMatches(matches: ScreeningMatch[]): MatchStatus {
  const active = matches.filter((m) => !m.ecarte);
  const isSanction = active.some((m) =>
    /sanction|sdn|consolidated|asset freeze/i.test(`${m.type} ${m.listes.join(" ")}`),
  );
  const isPep = active.some((m) => /pep|politically/i.test(m.type));
  const isMedia = active.some((m) => /adverse|media/i.test(m.type));
  return isSanction ? "sanction" : isPep ? "ppe" : isMedia ? "media" : "clear";
}

/**
 * Statut effectif d'un résultat compte tenu des faux positifs écartés.
 * Les statuts non probants (`demo`) ou en échec (`error`) restent inchangés.
 */
export function effectiveStatus(
  status: "clear" | "ppe" | "sanction" | "media" | "demo" | "error",
  matches: ScreeningMatch[],
): "clear" | "ppe" | "sanction" | "media" | "demo" | "error" {
  if (status === "demo" || status === "error") return status;
  return classifyMatches(matches);
}
