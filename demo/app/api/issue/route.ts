import { NextResponse } from "next/server";
import { getIssuerKey } from "@/lib/issuer";
import { issueEmblem, verifyEmblem, toB64url, toHex } from "@/lib/emblem";
import { emblemToSvcbRecord } from "@/lib/svcb";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn, ttl, aud } = await readJson<{ fqdn?: string; ttl?: number; aud?: string }>(req);
  if (!fqdn || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(fqdn)) {
    return NextResponse.json({ error: "provide a valid FQDN" }, { status: 400 });
  }
  const key = await getIssuerKey();
  const emblem = await issueEmblem({ sub: fqdn, aud, exp: ttl ? Math.floor(Date.now() / 1000) + ttl : undefined }, key);
  const record = emblemToSvcbRecord(fqdn, emblem, { ttl: ttl && ttl < 300 ? ttl : 300 });
  // decode claims for display via a self-verify against our own public key
  const decoded = await verifyEmblem(emblem, key.publicJwk, { expectedFqdn: fqdn });
  return NextResponse.json({
    fqdn,
    kid: key.kid,
    emblem: { base64url: toB64url(emblem), hex: toHex(emblem), bytes: emblem.length },
    claims: decoded.claims,
    svcb: record,
  });
}
