// Digital emblem = a COSE_Sign1 **hash envelope** (draft-ietf-cose-hash-envelope),
// signed with ES256. The payload is the hash of an external resource; the
// protected header carries the hash algorithm (258), the preimage content type
// (259), and the resource location (260). CWT claims ride in the protected
// header per RFC 9597 (label 15), kept minimal: `sub` plus a `cnf` (RFC 8747)
// COSE_Key so the holder can later prove possession. The whole object is served
// as application/digital-emblem+cose.
//
// Isomorphic: uses Web Crypto (globalThis.crypto) and cbor2.

import { encode, decode, Tag } from "cbor2";

export const COSE_SIGN1_TAG = 18;
export const EMBLEM_MEDIA_TYPE = "application/digital-emblem+cose";

// COSE header labels
const HDR_ALG = 1;
const HDR_KID = 4;
const HDR_CWT_CLAIMS = 15; // RFC 9597
const HDR_PAYLOAD_HASH_ALG = 258; // draft-ietf-cose-hash-envelope
const HDR_PREIMAGE_CT = 259;
const HDR_PAYLOAD_LOCATION = 260;

const ALG_ES256 = -7;
export const HASH_SHA256 = -16; // COSE algorithm id for SHA-256

// CWT claim keys
const CLAIM_SUB = 2;
const CLAIM_CNF = 8; // RFC 8747
const CNF_COSE_KEY = 1;

// COSE_Key (EC2) labels
const K_KTY = 1;
const K_KID = 2;
const K_CRV = -1;
const K_X = -2;
const K_Y = -3;
const KTY_EC2 = 2;
const CRV_P256 = 1;

const enc = new TextEncoder();
const dec = new TextDecoder();
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

// ---- base64url / hex -------------------------------------------------------

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
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateJwk, publicJwk, kid };
}

const importSign = (jwk: JsonWebKey) =>
  crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
const importVerify = (jwk: JsonWebKey) =>
  crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bs(data)));
}

// ---- COSE_Key <-> JWK (EC2 P-256 public) -----------------------------------

function coseKeyFromPublicJwk(jwk: JsonWebKey, kid?: string): Map<number, unknown> {
  const m = new Map<number, unknown>();
  m.set(K_KTY, KTY_EC2);
  if (kid) m.set(K_KID, enc.encode(kid));
  m.set(K_CRV, CRV_P256);
  m.set(K_X, fromB64url(jwk.x!));
  m.set(K_Y, fromB64url(jwk.y!));
  return m;
}

export interface CnfKey {
  jwk: JsonWebKey;
  kid?: string;
}

function publicJwkFromCoseKey(m: Map<number, unknown>): CnfKey {
  const x = m.get(K_X);
  const y = m.get(K_Y);
  const kidVal = m.get(K_KID);
  return {
    jwk: {
      kty: "EC",
      crv: "P-256",
      x: x instanceof Uint8Array ? toB64url(x) : "",
      y: y instanceof Uint8Array ? toB64url(y) : "",
    },
    kid: kidVal instanceof Uint8Array ? dec.decode(kidVal) : undefined,
  };
}

// ---- issue -----------------------------------------------------------------

export interface HashEmblemParams {
  /** Exact bytes of the resource being attested (the preimage). */
  resource: Uint8Array;
  /** Content type of the preimage (header 259). */
  contentType: string;
  /** Retrieval location of the preimage (header 260). */
  location: string;
  /** CWT `sub` claim (kept minimal). */
  sub?: string;
  /** Holder public key for the `cnf` proof-of-possession claim. */
  holderPublicJwk: JsonWebKey;
  holderKid?: string;
}

export async function issueHashEmblem(p: HashEmblemParams, key: IssuerKey): Promise<Uint8Array> {
  const hash = await sha256(p.resource);

  const cwtClaims = new Map<number, unknown>();
  if (p.sub) cwtClaims.set(CLAIM_SUB, p.sub);
  const cnf = new Map<number, unknown>();
  cnf.set(CNF_COSE_KEY, coseKeyFromPublicJwk(p.holderPublicJwk, p.holderKid));
  cwtClaims.set(CLAIM_CNF, cnf);

  const protectedMap = new Map<number, unknown>();
  protectedMap.set(HDR_ALG, ALG_ES256);
  protectedMap.set(HDR_KID, enc.encode(key.kid));
  protectedMap.set(HDR_CWT_CLAIMS, cwtClaims);
  protectedMap.set(HDR_PAYLOAD_HASH_ALG, HASH_SHA256);
  protectedMap.set(HDR_PREIMAGE_CT, p.contentType);
  protectedMap.set(HDR_PAYLOAD_LOCATION, p.location);
  const protectedHeader = encode(protectedMap);

  // Sig_structure = [ "Signature1", body_protected, external_aad, payload ]
  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), hash]);
  const signKey = await importSign(key.privateJwk);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, bs(toBeSigned)));

  const coseSign1 = new Tag(COSE_SIGN1_TAG, [protectedHeader, new Map(), hash, sig]);
  return encode(coseSign1);
}

// ---- verify ----------------------------------------------------------------

export interface VerifyResult {
  /** COSE_Sign1 signature validity. */
  valid: boolean;
  errors: string[];
  kid?: string;
  /** Hash algorithm (COSE id) and friendly name. */
  hashAlg?: number;
  hashAlgName?: string;
  /** Preimage content type (header 259). */
  preimageContentType?: string;
  /** Resource location (header 260). */
  location?: string;
  /** The payload = hash of the preimage, as hex. */
  payloadHashHex?: string;
  /** CWT `sub` claim, if present. */
  sub?: string;
  /** Holder proof-of-possession key from `cnf`. */
  cnf?: CnfKey;
}

function unwrap(value: unknown): unknown[] {
  let v = value;
  if (v instanceof Tag && v.tag === COSE_SIGN1_TAG) v = v.contents;
  if (!Array.isArray(v)) throw new Error("not a COSE_Sign1 structure");
  return v as unknown[];
}

export async function verifyEmblem(emblem: Uint8Array, publicJwk: JsonWebKey): Promise<VerifyResult> {
  const errors: string[] = [];
  let arr: unknown[];
  try {
    arr = unwrap(decode(emblem));
  } catch (e) {
    return { valid: false, errors: [`decode failed: ${(e as Error).message}`] };
  }

  const [protectedHeader, , payload, signature] = arr as [Uint8Array, unknown, Uint8Array, Uint8Array];

  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), payload]);
  let sigOk = false;
  try {
    const vk = await importVerify(publicJwk);
    sigOk = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vk, bs(signature), bs(toBeSigned));
  } catch (e) {
    errors.push(`signature check error: ${(e as Error).message}`);
  }
  if (!sigOk) errors.push("COSE signature is invalid");

  const hdr = decode(protectedHeader) as Map<number, unknown>;
  const kidVal = hdr.get(HDR_KID);
  const hashAlg = hdr.get(HDR_PAYLOAD_HASH_ALG) as number | undefined;
  const ct = hdr.get(HDR_PREIMAGE_CT);
  const loc = hdr.get(HDR_PAYLOAD_LOCATION) as string | undefined;

  let sub: string | undefined;
  let cnf: CnfKey | undefined;
  const cwt = hdr.get(HDR_CWT_CLAIMS);
  if (cwt instanceof Map) {
    const subVal = cwt.get(CLAIM_SUB);
    if (typeof subVal === "string") sub = subVal;
    const cnfMap = cwt.get(CLAIM_CNF);
    if (cnfMap instanceof Map && cnfMap.get(CNF_COSE_KEY) instanceof Map) {
      cnf = publicJwkFromCoseKey(cnfMap.get(CNF_COSE_KEY) as Map<number, unknown>);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    kid: kidVal instanceof Uint8Array ? dec.decode(kidVal) : undefined,
    hashAlg,
    hashAlgName: hashAlg === HASH_SHA256 ? "SHA-256" : hashAlg != null ? String(hashAlg) : undefined,
    preimageContentType: typeof ct === "number" ? String(ct) : (ct as string | undefined),
    location: loc,
    payloadHashHex: payload instanceof Uint8Array ? toHex(payload) : undefined,
    sub,
    cnf,
  };
}

/** SHA-256 of arbitrary bytes, hex — used to check a fetched resource against the emblem. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  return toHex(await sha256(data));
}

// ---- proof of possession (cnf key) -----------------------------------------

/**
 * The holder proves possession of the `cnf` key by signing a challenge with
 * the matching private key. The proof is a COSE_Sign1 over the challenge.
 */
export async function createPossessionProof(holderPrivateJwk: JsonWebKey, challenge: Uint8Array): Promise<Uint8Array> {
  const protectedMap = new Map<number, unknown>([[HDR_ALG, ALG_ES256]]);
  const protectedHeader = encode(protectedMap);
  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), challenge]);
  const sk = await importSign(holderPrivateJwk);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, sk, bs(toBeSigned)));
  return encode(new Tag(COSE_SIGN1_TAG, [protectedHeader, new Map(), challenge, sig]));
}

/**
 * Verify a possession proof against a public key (the emblem's `cnf` key) and
 * the expected challenge. Confirms the proof is a valid COSE_Sign1 by that key
 * over exactly the challenge.
 */
export async function verifyPossessionProof(
  holderPublicJwk: JsonWebKey,
  proof: Uint8Array,
  challenge: Uint8Array
): Promise<boolean> {
  let arr: unknown[];
  try {
    arr = unwrap(decode(proof));
  } catch {
    return false;
  }
  const [protectedHeader, , payload, signature] = arr as [Uint8Array, unknown, Uint8Array, Uint8Array];
  if (!(payload instanceof Uint8Array) || toHex(payload) !== toHex(challenge)) return false;
  const toBeSigned = encode(["Signature1", protectedHeader, new Uint8Array(0), payload]);
  try {
    const vk = await importVerify(holderPublicJwk);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vk, bs(signature), bs(toBeSigned));
  } catch {
    return false;
  }
}
