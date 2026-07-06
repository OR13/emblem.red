import { NextResponse } from "next/server";
import { getIssuerKey } from "@/lib/issuer";
import { issueEmblem, fromB64url } from "@/lib/emblem";
import { emblemToSvcbRecord } from "@/lib/svcb";
import { cloudflareConfigured, publishEmblem } from "@/lib/cloudflare";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn, emblem } = await readJson<{ fqdn?: string; emblem?: string }>(req);
  if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });

  // Use the supplied emblem, or freshly issue one for the FQDN.
  let bytes: Uint8Array;
  if (emblem) {
    bytes = fromB64url(emblem.trim());
  } else {
    const key = await getIssuerKey();
    bytes = await issueEmblem({ sub: fqdn }, key);
  }
  const record = emblemToSvcbRecord(fqdn, bytes);

  if (cloudflareConfigured()) {
    const result = await publishEmblem(fqdn, bytes);
    return NextResponse.json({ marked: result.published, via: "cloudflare", result, record });
  }
  return NextResponse.json({
    marked: false,
    via: "manual",
    note: "DNS provider not configured (set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID). Publish this record to mark the FQDN:",
    record,
  });
}
