import { describe, it, expect } from "vitest";
import {
  deriveKey,
  encryptJson,
  decryptJson,
  randomBytes,
  toBase64,
  fromBase64,
} from "../crypto";

// Itérations réduites en test pour la vitesse (la prod utilise 210k).
const ITER = 1000;

describe("base64", () => {
  it("fait un aller-retour fidèle", () => {
    const bytes = randomBytes(64);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("chiffrement AES-GCM / PBKDF2", () => {
  it("déchiffre ce qu'il a chiffré avec la bonne phrase", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("phrase-secrète-correcte", salt, ITER);
    const payload = { secret: "pièce d'identité", n: 42, list: [1, 2, 3] };
    const sealed = await encryptJson(key, payload);
    const out = await decryptJson(key, sealed);
    expect(out).toEqual(payload);
  });

  it("échoue avec une mauvaise phrase secrète", async () => {
    const salt = randomBytes(16);
    const good = await deriveKey("bonne", salt, ITER);
    const bad = await deriveKey("mauvaise", salt, ITER);
    const sealed = await encryptJson(good, { x: 1 });
    await expect(decryptJson(bad, sealed)).rejects.toBeDefined();
  });

  it("échoue si le ciphertext est altéré (authentification GCM)", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("phrase", salt, ITER);
    const sealed = await encryptJson(key, { x: 1 });
    const tampered = { ...sealed, ct: toBase64(randomBytes(fromBase64(sealed.ct).length)) };
    await expect(decryptJson(key, tampered)).rejects.toBeDefined();
  });

  it("produit un IV différent à chaque chiffrement", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("phrase", salt, ITER);
    const a = await encryptJson(key, { x: 1 });
    const b = await encryptJson(key, { x: 1 });
    expect(a.iv).not.toEqual(b.iv);
  });
});
