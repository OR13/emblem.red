import { NextResponse } from "next/server";
import { cloudflareConfigured, removeEmblem } from "@/lib/cloudflare";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { fqdn } = await readJson<{ fqdn?: string }>(req);
  if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });
  const owner = fqdn.replace(/\.$/, "");

  if (cloudflareConfigured()) {
    const result = await removeEmblem(fqdn);
    return NextResponse.json({ unmarked: result.published, via: "cloudflare", result });
  }
  return NextResponse.json({
    unmarked: false,
    via: "manual",
    note: `DNS provider not configured. Remove the emblem SvcParam from the HTTPS record at ${owner} to unmark the FQDN.`,
    owner,
  });
}
