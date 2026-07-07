import { NextResponse } from "next/server";
import { discoverEmblem } from "@/lib/svcb";
import { EMBLEM_MEDIA_TYPE } from "@/lib/emblem";
import { normalizeFqdn } from "@/lib/verify-service";

export const runtime = "nodejs";

// Serve the raw emblem for a domain with its own media type,
// application/digital-emblem+cose.
export async function GET(req: Request) {
  const fqdn = new URL(req.url).searchParams.get("fqdn");
  if (!fqdn) return NextResponse.json({ error: "provide ?fqdn=" }, { status: 400 });

  const disc = await discoverEmblem(normalizeFqdn(fqdn));
  if (!disc.found || !disc.emblem) {
    return NextResponse.json({ error: disc.error ?? "no emblem found" }, { status: 404 });
  }

  return new Response(Buffer.from(disc.emblem), {
    headers: {
      "content-type": EMBLEM_MEDIA_TYPE,
      "content-disposition": `inline; filename="${normalizeFqdn(fqdn)}.emblem.cose"`,
      "cache-control": "no-store",
    },
  });
}
