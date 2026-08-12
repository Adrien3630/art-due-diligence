import { describe, it, expect } from "vitest";
import { buildTimeStampReq, isTimestampingEnabled } from "../timestamp";
import { DEFAULT_SETTINGS } from "../vault";

const ZERO = "00".repeat(32); // empreinte de 32 octets nuls

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("buildTimeStampReq", () => {
  it("produit un TimeStampReq DER valide (version, OID SHA-256, empreinte)", () => {
    const req = buildTimeStampReq(ZERO, { certReq: true });
    const h = hex(req);
    // SEQUENCE
    expect(req[0]).toBe(0x30);
    // version INTEGER 1
    expect(h).toContain("020101");
    // OID SHA-256 : 06 09 60 86 48 01 65 03 04 02 01
    expect(h).toContain("0609608648016503040201");
    // OCTET STRING de 32 octets (04 20) suivie de l'empreinte nulle
    expect(h).toContain("0420" + "00".repeat(32));
    // certReq = TRUE
    expect(h.endsWith("0101ff")).toBe(true);
  });

  it("insère un nonce quand fourni", () => {
    const withNonce = buildTimeStampReq(ZERO, { nonce: new Uint8Array([0x01, 0x02]) });
    expect(hex(withNonce)).toContain("02020102");
  });

  it("préfixe 0x00 pour un nonce à bit de poids fort à 1 (INTEGER positif)", () => {
    const withNonce = buildTimeStampReq(ZERO, { nonce: new Uint8Array([0x80]) });
    expect(hex(withNonce)).toContain("02020080");
  });

  it("rejette une empreinte non-SHA256", () => {
    expect(() => buildTimeStampReq("abcd")).toThrow();
    expect(() => buildTimeStampReq("zz".repeat(32))).toThrow();
  });
});

describe("isTimestampingEnabled", () => {
  it("désactivé par défaut", () => {
    expect(isTimestampingEnabled(DEFAULT_SETTINGS)).toBe(false);
  });

  it("actif seulement si le drapeau ET l'URL sont présents", () => {
    expect(
      isTimestampingEnabled({ ...DEFAULT_SETTINGS, horodatageActif: true }),
    ).toBe(false);
    expect(
      isTimestampingEnabled({
        ...DEFAULT_SETTINGS,
        horodatageActif: true,
        horodatageTsaUrl: "https://tsa.example/tsr",
      }),
    ).toBe(true);
  });
});
