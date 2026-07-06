// Digital emblem = CWT (RFC 8392) protected as a COSE_Sign1 (RFC 9052),
// signed with ES256. When fully tagged the object is 61(18([...])):
// CWT tag (61) wrapping the COSE_Sign1 tag (18).
//
// This module is isomorphic: it uses the Web Crypto API (globalThis.crypto)
// and cbor2, both available in the browser and in Node's runtime.

import { encode, decode, Tag } from "cbor2";

export const COSE_SIGN1_TAG = 18;
export const CWT_TAG = 61;

// COSE header labels
const HDR_ALG = 1;
const HDR_KID = 4;
const ALG_ES256 = -7;

// CWT claim keys (RFC 8392 §3.1.1)
export const CLAIM = {
  iss: 1,
  sub: 2,
  aud: 3,
  exp: 4,
  nbf: 5,
  iat: 6,
  cti: 7,
} as const;

export interface EmblemClaims {
  iss?: string;
  sub: string; // the protected Asset FQDN
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  cti?: Uint8Array;
}

const enc = new TextEncoder();

// The bytes are valid BufferSource at runtime; this only bridges the
// Uint8Array<ArrayBufferLike> vs ArrayBufferView<ArrayBuffer> generic mismatch.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

// ---- base64url helpers -----------------------------------------------------

export function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- keys ------------------------------------------------------------------

export interface IssuerKey {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  kid: string;
}

export async function generateIssuerKey(kid = "emblem-demo-1"): Promise<IssuerKey> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateJwk, publicJwk, kid };
}

async function importSign(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function importVerify(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

// ---- issue -----------------------------------------------------------------

export async function issueEmblem(claims: EmblemClaims, key: IssuerKey): Promise<Uint8Array> {
  const now = Math.floor(Date.now() / 1000);
  const claimMap = new Map<number, unknown>();
  claimMap.set(CLAIM.iss, claims.iss ?? "emblem.red demo issuer");
  claimMap.set(CLAIM.sub, claims.sub);
  if (claims.aud) claimMap.set(CLAIM.aud, claims.aud);
  claimMap.set(CLAIM.iat, claims.iat ?? now);
  claimMap.set(CLAIM.nbf, claims.nbf ?? now);
  claimMap.set(CLAIM.exp, claims.exp ?? now + 3600);
  claimMap.set(CLAIM.cti, claims.cti ?? crypto.getRandomValues(new Uint8Array(8)));

  const payload = encode(claimMap);

  const protectedMap = new Map<number, unknown>();
  protectedMap.set(HDR_ALG, ALG_ES256);
  protectedMap.set(HDR_KID, enc.encode(key.kid));
  const protectedHeader = encode(protectedMap);

  // Sig_structure = [ "Signature1", body_protected, external_aad, payload ]
  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), payload]);

  const signKey = await importSign(key.privateJwk);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, bs(toBeSigned))
  );

  // COSE_Sign1 = [ protected, unprotected, payload, signature ]
  const coseSign1 = new Tag(COSE_SIGN1_TAG, [protectedHeader, new Map(), payload, sig]);
  const cwt = new Tag(CWT_TAG, coseSign1);
  return encode(cwt);
}

// ---- verify ----------------------------------------------------------------

export interface VerifyResult {
  valid: boolean;
  errors: string[];
  claims?: Record<string, unknown>;
}

function unwrap(value: unknown): unknown[] {
  // Accept 61(18([...])), 18([...]), or a bare [...] COSE_Sign1 array.
  let v = value;
  if (v instanceof Tag && v.tag === CWT_TAG) v = v.contents;
  if (v instanceof Tag && v.tag === COSE_SIGN1_TAG) v = v.contents;
  if (!Array.isArray(v)) throw new Error("not a COSE_Sign1 structure");
  return v as unknown[];
}

export async function verifyEmblem(
  emblem: Uint8Array,
  publicJwk: JsonWebKey,
  opts: { expectedFqdn?: string; now?: number } = {}
): Promise<VerifyResult> {
  const errors: string[] = [];
  let arr: unknown[];
  try {
    arr = unwrap(decode(emblem));
  } catch (e) {
    return { valid: false, errors: [`decode failed: ${(e as Error).message}`] };
  }

  const [protectedHeader, , payload, signature] = arr as [
    Uint8Array,
    unknown,
    Uint8Array,
    Uint8Array
  ];

  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), payload]);
  let sigOk = false;
  try {
    const vk = await importVerify(publicJwk);
    sigOk = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      vk,
      bs(signature),
      bs(toBeSigned)
    );
  } catch (e) {
    errors.push(`signature check error: ${(e as Error).message}`);
  }
  if (!sigOk) errors.push("COSE signature is invalid");

  // decode claims
  const claimsMap = decode(payload) as Map<number, unknown>;
  const claims: Record<string, unknown> = {};
  const nameByKey: Record<number, string> = {
    1: "iss",
    2: "sub",
    3: "aud",
    4: "exp",
    5: "nbf",
    6: "iat",
    7: "cti",
  };
  for (const [k, val] of claimsMap) {
    claims[nameByKey[k] ?? String(k)] = val instanceof Uint8Array ? toHex(val) : val;
  }

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const exp = claimsMap.get(CLAIM.exp) as number | undefined;
  const nbf = claimsMap.get(CLAIM.nbf) as number | undefined;
  if (typeof exp === "number" && now > exp) errors.push("emblem has expired (exp)");
  if (typeof nbf === "number" && now < nbf) errors.push("emblem is not yet valid (nbf)");

  const sub = claimsMap.get(CLAIM.sub) as string | undefined;
  if (opts.expectedFqdn) {
    if (sub !== opts.expectedFqdn) {
      errors.push(`subject (${sub}) does not match queried FQDN (${opts.expectedFqdn})`);
    }
  }

  return { valid: errors.length === 0, errors, claims };
}
