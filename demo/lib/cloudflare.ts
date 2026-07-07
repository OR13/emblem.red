import "server-only";
import { emblemToHttpsRecord } from "./svcb";

// Optional Cloudflare integration for publishing/removing the emblem. The
// emblem is carried in the asset's own HTTPS record (key65280) — the record
// clients already fetch at connection setup — so there is no dedicated,
// emblem-specific name to reveal that anyone is looking. Enabled only when both
// env vars are present; otherwise mark/unmark return the record to publish.

const API = "https://api.cloudflare.com/client/v4";

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

interface CfRecord {
  id: string;
  name: string;
  type: string;
}

async function findHttpsRecord(name: string): Promise<CfRecord | null> {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const res = await fetch(`${API}/zones/${zone}/dns_records?type=HTTPS&name=${encodeURIComponent(name)}`, {
    headers: headers(),
  });
  const json = (await res.json()) as { result?: CfRecord[] };
  return json.result?.[0] ?? null;
}

export interface DnsWriteResult {
  published: boolean;
  provider?: string;
  detail?: unknown;
  error?: string;
}

export async function publishEmblem(fqdn: string, emblem: Uint8Array): Promise<DnsWriteResult> {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const rec = emblemToHttpsRecord(fqdn, emblem);
  const body = { type: "HTTPS", name: rec.owner, data: { priority: rec.priority, target: rec.target, value: rec.value }, ttl: rec.ttl };
  const existing = await findHttpsRecord(rec.owner);
  const url = existing ? `${API}/zones/${zone}/dns_records/${existing.id}` : `${API}/zones/${zone}/dns_records`;
  const res = await fetch(url, {
    method: existing ? "PUT" : "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; errors?: unknown };
  if (!json.success) return { published: false, provider: "cloudflare", error: JSON.stringify(json.errors) };
  return { published: true, provider: "cloudflare", detail: `${rec.owner} HTTPS` };
}

export async function removeEmblem(fqdn: string): Promise<DnsWriteResult> {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const name = fqdn.replace(/\.$/, "");
  const existing = await findHttpsRecord(name);
  if (!existing) return { published: false, provider: "cloudflare", detail: "no HTTPS record found" };
  const res = await fetch(`${API}/zones/${zone}/dns_records/${existing.id}`, {
    method: "DELETE",
    headers: headers(),
  });
  const json = (await res.json()) as { success: boolean; errors?: unknown };
  if (!json.success) return { published: false, provider: "cloudflare", error: JSON.stringify(json.errors) };
  return { published: true, provider: "cloudflare", detail: `removed ${name} HTTPS` };
}
