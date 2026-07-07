import { NextResponse } from "next/server";
import { getIssuerKey, getHolderKey } from "@/lib/issuer";
import { issueHashEmblem, fromB64url } from "@/lib/emblem";
import { emblemToHttpsRecord } from "@/lib/svcb";
import { cloudflareConfigured, publishEmblem } from "@/lib/cloudflare";
import { RESOURCE_CONTENT_TYPE, RESOURCE_LOCATION, resourceFetchUrl } from "@/lib/resource";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn, emblem } = await readJson<{ fqdn?: string; emblem?: string }>(req);
  if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });

  // Use the supplied emblem, or freshly issue a hash envelope over the resource.
  let bytes: Uint8Array;
  if (emblem) {
    bytes = fromB64url(emblem.trim());
  } else {
    const issuer = await getIssuerKey();
    const holder = getHolderKey();
    const r = await fetch(resourceFetchUrl(), { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: `could not fetch resource to hash: HTTP ${r.status}` }, { status: 502 });
    const resource = new Uint8Array(await r.arrayBuffer());
    bytes = await issueHashEmblem(
      { resource, contentType: RESOURCE_CONTENT_TYPE, location: RESOURCE_LOCATION, sub: RESOURCE_LOCATION, holderPublicJwk: holder.publicJwk, holderKid: holder.kid },
      issuer
    );
  }
  const record = emblemToHttpsRecord(fqdn, bytes);

  if (cloudflareConfigured()) {
    const result = await publishEmblem(fqdn, bytes);
    return NextResponse.json({ marked: result.published, via: "cloudflare", result, record });
  }
  return NextResponse.json({
    marked: false,
    via: "manual",
    note: "DNS provider not configured (set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID). Publish this HTTPS record to mark the FQDN:",
    record,
  });
}
