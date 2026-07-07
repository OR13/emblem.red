import { NextResponse } from "next/server";
import { getIssuerKey, getHolderKey } from "@/lib/issuer";
import { issueHashEmblem, verifyEmblem, toB64url, toHex, EMBLEM_MEDIA_TYPE } from "@/lib/emblem";
import { emblemToHttpsRecord } from "@/lib/svcb";
import { RESOURCE_CONTENT_TYPE, RESOURCE_LOCATION, resourceFetchUrl } from "@/lib/resource";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn } = await readJson<{ fqdn?: string }>(req);

  const issuer = await getIssuerKey();
  const holder = getHolderKey();

  let resource: Uint8Array;
  try {
    const r = await fetch(resourceFetchUrl(), { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    resource = new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    return NextResponse.json({ error: `could not fetch resource to hash: ${(e as Error).message}` }, { status: 502 });
  }

  const emblem = await issueHashEmblem(
    {
      resource,
      contentType: RESOURCE_CONTENT_TYPE,
      location: RESOURCE_LOCATION,
      sub: RESOURCE_LOCATION,
      holderPublicJwk: holder.publicJwk,
      holderKid: holder.kid,
    },
    issuer
  );

  const decoded = await verifyEmblem(emblem, issuer.publicJwk);
  const record = fqdn ? emblemToHttpsRecord(fqdn, emblem) : undefined;

  return NextResponse.json({
    mediaType: EMBLEM_MEDIA_TYPE,
    kid: issuer.kid,
    emblem: { base64url: toB64url(emblem), hex: toHex(emblem), bytes: emblem.length },
    envelope: {
      hashAlg: decoded.hashAlgName,
      preimageContentType: decoded.preimageContentType,
      location: decoded.location,
      payloadHash: decoded.payloadHashHex,
      sub: decoded.sub,
      cnf: decoded.cnf,
    },
    https: record,
  });
}
