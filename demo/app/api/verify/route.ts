import { NextResponse } from "next/server";
import { getIssuerKey } from "@/lib/issuer";
import { verifyEmblem, fromB64url } from "@/lib/emblem";
import { discoverEmblem, emblemFromSvcbPresentation } from "@/lib/svcb";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJson<{
    fqdn?: string;
    source?: "dns" | "emblem" | "record";
    emblem?: string; // base64url
    record?: string; // SVCB rdata presentation
  }>(req);
  const { fqdn, source = "dns" } = body;
  const key = await getIssuerKey();

  let emblem: Uint8Array | null = null;
  let discovery: unknown = undefined;

  try {
    if (source === "emblem" && body.emblem) {
      emblem = fromB64url(body.emblem.trim());
    } else if (source === "record" && body.record) {
      emblem = emblemFromSvcbPresentation(body.record);
      if (!emblem) return NextResponse.json({ error: "no emblem SvcParam found in record" }, { status: 400 });
    } else {
      if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });
      const res = await discoverEmblem(fqdn);
      discovery = { found: res.found, rdata: res.rdata, error: res.error };
      if (!res.found || !res.emblem) {
        return NextResponse.json({ valid: false, discovery, errors: [res.error ?? "no emblem in DNS"] });
      }
      emblem = res.emblem;
    }
  } catch (e) {
    return NextResponse.json({ error: `could not read emblem: ${(e as Error).message}` }, { status: 400 });
  }

  const result = await verifyEmblem(emblem, key.publicJwk, { expectedFqdn: fqdn });
  return NextResponse.json({ ...result, discovery, verifiedWithKid: key.kid });
}
