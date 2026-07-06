import { NextResponse } from "next/server";
import { getIssuerKey } from "@/lib/issuer";

export const runtime = "nodejs";

export async function GET() {
  const key = await getIssuerKey();
  return NextResponse.json({ kid: key.kid, publicJwk: key.publicJwk });
}
