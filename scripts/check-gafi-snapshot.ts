/*
  Vérifie la fraîcheur du snapshot GAFI figé dans le code et expose le verdict.
  Utilisé par le workflow CI de rappel (.github/workflows/gafi-reminder.yml).

  Ne modifie RIEN et n'écrit AUCUNE liste : la mise à jour des juridictions
  reste manuelle et vérifiée par un humain. Ce script se contente d'alerter.

  Lancement : `npx tsx scripts/check-gafi-snapshot.ts`
*/

import { appendFileSync } from "node:fs";
import {
  GAFI_SNAPSHOT_DATE,
  GAFI_SNAPSHOT_MAX_AGE_MONTHS,
  gafiSnapshotAgeMonths,
  isGafiSnapshotStale,
} from "../src/lib/jurisdictions";

const stale = isGafiSnapshotStale();
const age = gafiSnapshotAgeMonths();

console.log(
  `Snapshot GAFI : « ${GAFI_SNAPSHOT_DATE} » — ${age} mois ` +
    `(seuil de péremption : ${GAFI_SNAPSHOT_MAX_AGE_MONTHS} mois) → ` +
    (stale ? "PÉRIMÉ" : "à jour"),
);

// Expose le résultat aux étapes suivantes du workflow (si en CI).
const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(
    out,
    `stale=${stale}\nage=${age}\nsnapshot=${GAFI_SNAPSHOT_DATE}\n`,
  );
}
