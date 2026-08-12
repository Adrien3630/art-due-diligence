"use client";

/*
  Porte du coffre chiffré. Tant que le coffre n'est pas déverrouillé, l'app n'est
  pas rendue : aucune donnée déchiffrée n'est exposée.

  Modes :
   • create / migrate : définir une phrase secrète (jauge de force) → afficher la
     CLÉ DE RÉCUPÉRATION une fois.
   • unlock           : saisir la phrase secrète ; lien « phrase oubliée ».
   • recover          : saisir la clé de récupération → définir une NOUVELLE phrase.
   • showRecovery     : afficher la clé de récupération à conserver.
   • ready            : app rendue + verrouillage auto sur inactivité.
*/

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { AutoLock } from "@/components/AutoLock";
import {
  changePassphrase,
  createVault,
  hasLegacyData,
  hasVault,
  isUnlocked,
  lock,
  unlock,
  unlockWithRecovery,
} from "@/lib/vault";
import { loadSettings } from "@/lib/storage";
import { estimatePassphrase } from "@/lib/passphrase";

type Mode =
  | "loading"
  | "create"
  | "migrate"
  | "unlock"
  | "recover"
  | "setNewPass"
  | "showRecovery"
  | "ready";

const METER_COLOR = [
  "var(--color-risk-high)",
  "var(--color-risk-high)",
  "var(--color-risk-mid)",
  "var(--color-risk-low)",
  "var(--color-risk-low)",
];

export function VaultGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
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

  const strength = useMemo(() => estimatePassphrase(pass), [pass]);

  function resetFields() {
    setPass("");
    setConfirm("");
    setRecoveryInput("");
    setError("");
  }

  if (mode === "loading") return null;

  if (mode === "ready") {
    const minutes = loadSettings().autoLockMinutes ?? 10;
    return (
      <>
        <AutoLock
          minutes={minutes}
          onLock={() => {
            lock();
            resetFields();
            setMode("unlock");
          }}
        />
        {children}
      </>
    );
  }

  // ── Écran : clé de récupération à conserver ────────────────────────────
  if (mode === "showRecovery") {
    return (
      <Shell title="Votre clé de récupération">
        <p className="text-[0.8rem] leading-relaxed text-ink-soft">
          Conservez cette clé <strong>hors de cet ordinateur</strong> (imprimée, coffre-fort,
          gestionnaire de mots de passe). Elle permet de rouvrir le coffre si vous
          <strong> oubliez votre phrase secrète</strong> — c'est votre seule autre issue.
        </p>
        <div className="my-4 select-all rounded-md border border-line-strong bg-surface-2 p-4 text-center font-mono text-[1.05rem] tracking-wide text-ink">
          {recoveryCode}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigator.clipboard?.writeText(recoveryCode).catch(() => {})}
            className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
          >
            Copier
          </button>
          <Button
            {...({ type: "button" } as object)}
            onClick={() => {
              setRecoveryCode("");
              resetFields();
              setMode("ready");
            }}
          >
            J'ai noté ma clé — continuer
          </Button>
        </div>
        <p className="mt-4 text-[0.7rem] leading-relaxed text-risk-mid">
          ⚠︎ Perte de la phrase <em>et</em> de cette clé = données irrécupérables.
        </p>
      </Shell>
    );
  }

  const creating = mode === "create" || mode === "migrate";
  const settingNew = mode === "setNewPass";
  const needsStrength = creating || settingNew;

  async function submit() {
    setError("");
    if (busy) return;

    if (mode === "recover") {
      setBusy(true);
      const ok = await unlockWithRecovery(recoveryInput);
      setBusy(false);
      if (ok) {
        resetFields();
        setMode("setNewPass");
      } else {
        setError("Clé de récupération invalide.");
      }
      return;
    }

    if (needsStrength) {
      const st = estimatePassphrase(pass);
      if (!st.acceptable) return setError(st.hint);
      if (pass !== confirm) return setError("Les deux saisies ne correspondent pas.");
      setBusy(true);
      if (settingNew) {
        await changePassphrase(pass);
        setBusy(false);
        resetFields();
        setMode("ready"); // coffre déjà ouvert par la clé de récupération
      } else {
        const { recoveryCode: code } = await createVault(pass);
        setBusy(false);
        setRecoveryCode(code);
        resetFields();
        setMode("showRecovery");
      }
      return;
    }

    // unlock
    setBusy(true);
    const res = await unlock(pass);
    setBusy(false);
    if (!res.ok) return setError("Phrase secrète incorrecte.");
    resetFields();
    if (res.recoveryCode) {
      // Coffre v1 migré en v2 → présenter la nouvelle clé de récupération.
      setRecoveryCode(res.recoveryCode);
      setMode("showRecovery");
    } else {
      setMode("ready");
    }
  }

  const title =
    mode === "unlock"
      ? "Déverrouiller le coffre"
      : mode === "recover"
        ? "Clé de récupération"
        : mode === "setNewPass"
          ? "Définir une nouvelle phrase secrète"
          : mode === "migrate"
            ? "Protéger vos données existantes"
            : "Protéger vos données";

  const desc =
    mode === "unlock"
      ? "Vos dossiers sont chiffrés sur cet ordinateur. Saisissez votre phrase secrète."
      : mode === "recover"
        ? "Saisissez votre clé de récupération pour rouvrir le coffre, puis choisissez une nouvelle phrase secrète."
        : mode === "setNewPass"
          ? "Coffre rouvert. Choisissez une nouvelle phrase secrète que vous retiendrez."
          : mode === "migrate"
            ? "Des dossiers non chiffrés ont été trouvés. Définissez une phrase secrète : ils seront chiffrés et les copies en clair supprimées."
            : "Choisissez une phrase secrète (idéalement 4 mots). Elle chiffre tout et n'est jamais stockée.";

  return (
    <Shell title={title}>
      <p className="text-[0.78rem] leading-relaxed text-muted">{desc}</p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {mode === "recover" ? (
          <input
            className="input-line font-mono"
            autoFocus
            value={recoveryInput}
            onChange={(e) => setRecoveryInput(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-…"
            aria-label="Clé de récupération"
          />
        ) : (
          <>
            <input
              className="input-line"
              type="password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={settingNew ? "Nouvelle phrase secrète" : "Phrase secrète"}
              aria-label={settingNew ? "Nouvelle phrase secrète" : "Phrase secrète"}
            />
            {needsStrength && (
              <input
                className="input-line"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmer la phrase secrète"
                aria-label="Confirmer la phrase secrète"
              />
            )}
            {needsStrength && pass && (
              <div aria-label="Force de la phrase secrète">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        background:
                          i <= strength.score ? METER_COLOR[strength.score] : "var(--color-surface-2)",
                      }}
                    />
                  ))}
                </div>
                <p
                  className="mt-1 text-[0.7rem]"
                  style={{ color: strength.acceptable ? "var(--color-muted)" : METER_COLOR[strength.score] }}
                >
                  {strength.label} · {strength.hint}
                </p>
              </div>
            )}
          </>
        )}

        {error && <p className="text-[0.74rem] text-risk-high">{error}</p>}

        <Button
          {...({ type: "submit" } as object)}
          disabled={busy || (mode === "recover" ? !recoveryInput : !pass)}
        >
          {busy
            ? "…"
            : mode === "unlock"
              ? "Déverrouiller"
              : mode === "recover"
                ? "Vérifier la clé"
                : settingNew
                  ? "Enregistrer la phrase"
                  : "Chiffrer et continuer"}
        </Button>
      </form>

      {mode === "unlock" && (
        <button
          onClick={() => {
            resetFields();
            setMode("recover");
          }}
          className="mt-4 text-[0.72rem] text-muted underline-offset-2 hover:text-gold hover:underline"
        >
          Phrase oubliée ? Utiliser la clé de récupération
        </button>
      )}

      {creating && (
        <p className="mt-4 text-[0.7rem] leading-relaxed text-risk-mid">
          ⚠︎ Une clé de récupération vous sera remise à l'étape suivante : conservez-la
          hors de cet ordinateur.
        </p>
      )}

      <p className="mt-4 text-center text-[0.68rem] text-muted">
        Chiffrement AES-GCM 256 · clé dérivée par Argon2id · 100 % local
      </p>
    </Shell>
  );
}

/** Coquille visuelle commune aux écrans du coffre. */
function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-serif text-[1.8rem] leading-none text-ink">Provenance</div>
          <div className="rule-gold mx-auto mt-3 w-12" />
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(23,20,15,0.05)]">
          <h1 className="font-serif text-xl text-ink">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
