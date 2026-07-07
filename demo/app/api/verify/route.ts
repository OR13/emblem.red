import { NextResponse } from "next/server";
import { getIssuerKey } from "@/lib/issuer";
import { verifyEmblem, fromB64url } from "@/lib/emblem";
import { emblemFromSvcbPresentation } from "@/lib/svcb";
import { scanAndVerify } from "@/lib/verify-service";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJson<{
    fqdn?: string;
    source?: "dns" | "emblem" | "record";
    emblem?: string;
    record?: string;
  }>(req);
  const { fqdn, source = "dns" } = body;

  // From DNS: full discover + verify + resource re-hash.
  if (source === "dns") {
    if (!fqdn) return NextResponse.json({ error: "provide an FQDN" }, { status: 400 });
    return NextResponse.json(await scanAndVerify(fqdn));
  }

  // Pasted emblem or record: signature + header parse only.
  let bytes: Uint8Array | null = null;
  try {
    if (source === "emblem" && body.emblem) bytes = fromB64url(body.emblem.trim());
    else if (source === "record" && body.record) bytes = emblemFromSvcbPresentation(body.record);
  } catch (e) {
    return NextResponse.json({ error: `could not read emblem: ${(e as Error).message}` }, { status: 400 });
  }
  if (!bytes) return NextResponse.json({ error: "no emblem provided" }, { status: 400 });

  const key = await getIssuerKey();
  const v = await verifyEmblem(bytes, key.publicJwk);
  return NextResponse.json(v);
}
