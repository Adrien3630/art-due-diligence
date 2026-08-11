"use client";

/*
  Porte du coffre chiffré. Tant que le coffre n'est pas déverrouillé, l'app n'est
  pas rendue : aucune donnée déchiffrée n'est exposée.

  Trois modes :
   • create   : premier lancement, aucune donnée → définir une phrase secrète.
   • migrate  : données en clair héritées détectées → on les chiffre en créant
                la phrase secrète (puis on supprime les anciennes copies).
   • unlock   : coffre existant → saisir la phrase secrète.
*/

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import {
  createVault,
  hasLegacyData,
  hasVault,
  isUnlocked,
  unlock,
} from "@/lib/vault";

type Mode = "loading" | "create" | "migrate" | "unlock" | "ready";

const MIN_LEN = 8;

export function VaultGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (isUnlocked()) setMode("ready");
      else if (await hasVault()) setMode("unlock");
      else if (hasLegacyData()) setMode("migrate");
      else setMode("create");
    })();
  }, []);

  if (mode === "loading") return null;
  if (mode === "ready") return <>{children}</>;

  const creating = mode === "create" || mode === "migrate";

  async function submit() {
    setError("");
    if (creating) {
      if (pass.length < MIN_LEN) {
        setError(`Phrase secrète trop courte (au moins ${MIN_LEN} caractères).`);
        return;
      }
      if (pass !== confirm) {
        setError("Les deux saisies ne correspondent pas.");
        return;
      }
      setBusy(true);
      await createVault(pass);
      setBusy(false);
      setMode("ready");
      return;
    }
    // unlock
    setBusy(true);
    const ok = await unlock(pass);
    setBusy(false);
    if (ok) setMode("ready");
    else setError("Phrase secrète incorrecte.");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-serif text-[1.8rem] leading-none text-ink">Provenance</div>
          <div className="rule-gold mx-auto mt-3 w-12" />
        </div>

        <div className="rounded-lg border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(23,20,15,0.05)]">
          <h1 className="font-serif text-xl text-ink">
            {mode === "unlock"
              ? "Déverrouiller le coffre"
              : mode === "migrate"
                ? "Protéger vos données existantes"
                : "Protéger vos données"}
          </h1>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
            {mode === "unlock"
              ? "Vos dossiers sont chiffrés sur cet ordinateur. Saisissez votre phrase secrète."
              : mode === "migrate"
                ? "Des dossiers non chiffrés ont été trouvés. Définissez une phrase secrète : ils seront chiffrés et les copies en clair supprimées."
                : "Choisissez une phrase secrète. Elle chiffre tout (identités, pièces, clés API) et n'est jamais stockée."}
          </p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) submit();
            }}
          >
            <input
              className="input-line"
              type="password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Phrase secrète"
              aria-label="Phrase secrète"
            />
            {creating && (
              <input
                className="input-line"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmer la phrase secrète"
                aria-label="Confirmer la phrase secrète"
              />
            )}
            {error && <p className="text-[0.74rem] text-risk-high">{error}</p>}
            <Button {...({ type: "submit" } as object)} disabled={busy || !pass}>
              {busy
                ? "…"
                : mode === "unlock"
                  ? "Déverrouiller"
                  : "Chiffrer et continuer"}
            </Button>
          </form>

          {creating && (
            <p className="mt-4 text-[0.7rem] leading-relaxed text-risk-mid">
              ⚠︎ Sans cette phrase, les données seront irrécupérables. Notez-la en
              lieu sûr et pensez à exporter une sauvegarde chiffrée (Paramètres).
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[0.68rem] text-muted">
          Chiffrement AES-GCM 256 · clé dérivée par PBKDF2 · 100 % local
        </p>
      </div>
    </div>
  );
}
