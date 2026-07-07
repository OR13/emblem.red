import "server-only";
import { type IssuerKey } from "./emblem";

// Server-side demo issuer key.
//
// For a stable deployment, set EMBLEM_ISSUER_JWK to a private P-256 JWK (JSON)
// and EMBLEM_ISSUER_KID to its key id. Without them we generate an ephemeral
// key at process start — fine for a single-instance demo, but emblems issued
// before a restart will no longer verify against the new key.

// Fixed, INSECURE demo key. Serverless functions are stateless, so an
// ephemeral key would differ between the lambda that issues and the one that
// verifies. This committed key keeps issue<->verify consistent out of the box.
// It is public by design — never use it for anything real. Override in
// production with EMBLEM_ISSUER_JWK.
const DEMO_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk",
  y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo",
  d: "mlbmSJUK4hUceTO9IRBmVlhO5GT_1-1dufOsCvDrDS0",
};

let cached: Promise<IssuerKey> | null = null;

function fromPrivateJwk(privateJwk: JsonWebKey, kid: string): IssuerKey {
  const publicJwk: JsonWebKey = {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
  };
  return { privateJwk, publicJwk, kid };
}

export function getIssuerKey(): Promise<IssuerKey> {
  if (cached) return cached;
  cached = (async () => {
    const kid = process.env.EMBLEM_ISSUER_KID ?? "emblem-demo-1";
    const raw = process.env.EMBLEM_ISSUER_JWK;
    if (raw) return fromPrivateJwk(JSON.parse(raw) as JsonWebKey, kid);
    return fromPrivateJwk(DEMO_JWK, kid);
  })();
  return cached;
}

// Demo holder public key, placed in the emblem's `cnf` claim (RFC 8747) so the
// holder can later prove possession. INSECURE demo value; the matching private
// key is not needed by the issuer. Override with EMBLEM_HOLDER_JWK (public).
const DEMO_HOLDER_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: "XLGv7xfBaFtPu9kq5Dv9EWDORjxnsc9l7bqc1zMJCqA",
  y: "DzKTaiV4sSTiPMvN_n_YsZybjsSLH_C8w3WHU-t7akQ",
};

export function getHolderKey(): { publicJwk: JsonWebKey; kid: string } {
  const kid = process.env.EMBLEM_HOLDER_KID ?? "holder-demo-1";
  const raw = process.env.EMBLEM_HOLDER_JWK;
  return { publicJwk: raw ? (JSON.parse(raw) as JsonWebKey) : DEMO_HOLDER_JWK, kid };
}
