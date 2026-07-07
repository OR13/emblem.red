import "server-only";
import { getIssuerKey } from "./issuer";
import { verifyEmblem, sha256Hex, toB64url, EMBLEM_MEDIA_TYPE, type VerifyResult, type CnfKey } from "./emblem";
import { discoverEmblem } from "./svcb";
import { resolveFetchUrl } from "./resource";
import { commentedHex, groupedHex, type HexLine } from "./cbor-hex";

export interface Landmark {
  name?: string;
  localName?: string;
  city?: string;
  country?: string;
  protected?: boolean;
  coords?: [number, number]; // [lon, lat]
}

export interface ResourceCheck {
  fetched: boolean;
  hashMatch?: boolean;
  bytes?: number;
  contentType?: string;
  fetchedFrom?: string;
  error?: string;
  /** Parsed structured data (GeoJSON landmark) inside the application/json resource. */
  landmark?: Landmark;
}

export interface ScanResult {
  /** The asset FQDN that was scanned (normalized). */
  fqdn: string;
  /** The DNS owner name actually queried (the asset FQDN itself). */
  ownerName: string;
  /** The record type queried (always HTTPS). */
  queryType?: "HTTPS";
  /** Whether an emblem was found in DNS. */
  found: boolean;
  /** Raw record rdata as returned by the resolver (generic form). */
  rdata?: string;
  byteLength?: number;
  base64url?: string;
  hex?: string;
  cbor?: HexLine[];
  /** Media type of the emblem object. */
  mediaType?: string;
  /** Trust anchor kid used to verify. */
  verifiedWithKid?: string;
  discoveryError?: string;

  // ---- hash-envelope fields (from the protected header) ----
  hashAlgName?: string;
  preimageContentType?: string;
  location?: string;
  payloadHashHex?: string;
  sub?: string;
  cnf?: CnfKey;

  // ---- checks ----
  checks?: { sigOk: boolean; hashOk: boolean };
  /** The referenced resource, re-fetched and re-hashed. */
  resource?: ResourceCheck;
  errors?: string[];
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
 * Discover the emblem in the asset's HTTPS record, verify its COSE signature
 * against the demo trust anchor, then re-fetch the referenced resource and
 * confirm its hash matches the signed payload. Pure server-side.
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
  const v: VerifyResult = await verifyEmblem(disc.emblem, key.publicJwk);

  // Re-fetch the referenced resource and re-hash it.
  let resource: ResourceCheck = { fetched: false };
  let hashOk = false;
  if (v.location && v.payloadHashHex) {
    const url = resolveFetchUrl(v.location);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const h = await sha256Hex(bytes);
        hashOk = h === v.payloadHashHex;
        let landmark: Landmark | undefined;
        try {
          const j = JSON.parse(new TextDecoder().decode(bytes));
          const p = j?.properties ?? {};
          const c = j?.geometry?.coordinates;
          landmark = {
            name: p.name,
            localName: p.localName,
            city: p.city,
            country: p.country,
            protected: Boolean(p.protected),
            coords: Array.isArray(c) && c.length >= 2 ? [c[0], c[1]] : undefined,
          };
        } catch {
          /* not JSON we understand */
        }
        resource = {
          fetched: true,
          hashMatch: hashOk,
          bytes: bytes.length,
          contentType: res.headers.get("content-type")?.split(";")[0] ?? undefined,
          fetchedFrom: url,
          landmark,
        };
      } else {
        resource = { fetched: false, error: `HTTP ${res.status}`, fetchedFrom: url };
      }
    } catch (e) {
      resource = { fetched: false, error: (e as Error).message, fetchedFrom: url };
    }
  }

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
    mediaType: EMBLEM_MEDIA_TYPE,
    verifiedWithKid: v.kid ?? key.kid,
    hashAlgName: v.hashAlgName,
    preimageContentType: v.preimageContentType,
    location: v.location,
    payloadHashHex: v.payloadHashHex,
    sub: v.sub,
    cnf: v.cnf,
    checks: { sigOk: v.valid, hashOk },
    resource,
    errors: v.errors,
  };
}
