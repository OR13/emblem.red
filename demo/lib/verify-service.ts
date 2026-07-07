import "server-only";
import { getIssuerKey } from "./issuer";
import { verifyEmblem, toB64url, type VerifyResult } from "./emblem";
import { discoverEmblem } from "./svcb";
import { commentedHex, groupedHex, type HexLine } from "./cbor-hex";

export interface ScanResult {
  /** The asset FQDN that was scanned (normalized). */
  fqdn: string;
  /** The DNS owner name actually queried (the asset FQDN itself). */
  ownerName: string;
  /** The record type queried (always HTTPS). */
  queryType?: "HTTPS";
  /** Whether an emblem SvcParam was found in DNS. */
  found: boolean;
  /** Raw SVCB rdata as returned by the resolver (presentation or generic). */
  rdata?: string;
  /** Emblem size in bytes. */
  byteLength?: number;
  /** base64url of the raw emblem bytes. */
  base64url?: string;
  /** Full emblem bytes as space-grouped hex. */
  hex?: string;
  /** CBOR commented-hex pretty-print of the emblem. */
  cbor?: HexLine[];
  /** Full verification result (signature, validity window, sub match). */
  verify?: VerifyResult;
  /** Key id of the trust anchor used to verify. */
  verifiedWithKid?: string;
  /** Discovery-layer error (DoH failure, no record, etc.). */
  discoveryError?: string;
  /** Individual verification checks, precomputed server-side. */
  checks?: { sigOk: boolean; subOk: boolean; windowOk: boolean };
  /** Human-formatted timestamps (computed server-side so render stays pure). */
  times?: { iat: FormattedTime | null; nbf: FormattedTime | null; exp: FormattedTime | null };
  /** Whether the emblem is past its `exp`. */
  expired?: boolean;
}

export interface FormattedTime {
  iso: string;
  rel: string;
}

/** Format an epoch-seconds value as ISO + relative ("in 1 year"). */
function fmtEpoch(sec: unknown, nowMs: number): FormattedTime | null {
  if (typeof sec !== "number") return null;
  const ms = sec * 1000;
  const iso = new Date(ms).toISOString().replace(".000", "");
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const [unit, div]: [Intl.RelativeTimeFormatUnit, number] =
    abs < 60_000 ? ["second", 1000]
    : abs < 3_600_000 ? ["minute", 60_000]
    : abs < 86_400_000 ? ["hour", 3_600_000]
    : abs < 2_592_000_000 ? ["day", 86_400_000]
    : ["year", 31_536_000_000];
  return { iso, rel: rtf.format(Math.round(diff / div), unit) };
}

/** Normalize user-supplied host input into a bare FQDN. */
export function normalizeFqdn(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Scan the asset's own HTTPS record for an emblem and verify it against the
 * demo trust anchor. Pure server-side (DoH + WebCrypto); safe to call from a
 * Server Component or a route handler.
 */
export async function scanAndVerify(rawFqdn: string): Promise<ScanResult> {
  const fqdn = normalizeFqdn(rawFqdn);

  const disc = await discoverEmblem(fqdn);
  if (!disc.found || !disc.emblem) {
    return {
      fqdn,
      ownerName: disc.qname ?? fqdn,
      queryType: disc.qtype,
      found: false,
      discoveryError: disc.error,
      rdata: disc.rdata,
    };
  }

  const key = await getIssuerKey();
  const verify = await verifyEmblem(disc.emblem, key.publicJwk, { expectedFqdn: fqdn });

  const nowMs = Date.now();
  const claims = verify.claims ?? {};
  const errs = verify.errors;
  const checks = {
    sigOk: !errs.some((e) => e.toLowerCase().includes("signature")),
    subOk: claims.sub === fqdn,
    windowOk: !errs.some((e) => e.includes("expired") || e.includes("not yet valid")),
  };
  const times = {
    iat: fmtEpoch(claims.iat, nowMs),
    nbf: fmtEpoch(claims.nbf, nowMs),
    exp: fmtEpoch(claims.exp, nowMs),
  };
  const expired = typeof claims.exp === "number" && claims.exp * 1000 < nowMs;

  return {
    fqdn,
    ownerName: disc.qname ?? fqdn,
    queryType: disc.qtype,
    found: true,
    rdata: disc.rdata,
    byteLength: disc.emblem.length,
    base64url: toB64url(disc.emblem),
    hex: groupedHex(disc.emblem),
    cbor: commentedHex(disc.emblem),
    verify,
    verifiedWithKid: key.kid,
    checks,
    times,
    expired,
  };
}
