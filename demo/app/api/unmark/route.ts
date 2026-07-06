import { NextResponse } from "next/server";
import { EMBLEM_OWNER_PREFIX } from "@/lib/svcb";
import { cloudflareConfigured, removeEmblem } from "@/lib/cloudflare";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn } = await readJson<{ fqdn?: string }>(req);
  if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });
  const owner = EMBLEM_OWNER_PREFIX + fqdn.replace(/\.$/, "");

  if (cloudflareConfigured()) {
    const result = await removeEmblem(fqdn);
    return NextResponse.json({ unmarked: result.published, via: "cloudflare", result });
  }
  return NextResponse.json({
    unmarked: false,
    via: "manual",
    note: `DNS provider not configured. Remove the SVCB record at ${owner} to unmark the FQDN.`,
    owner,
  });
}
