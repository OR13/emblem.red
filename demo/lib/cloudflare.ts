import "server-only";
import { EMBLEM_SVCPARAM_KEY, escapeCharString, EMBLEM_OWNER_PREFIX } from "./svcb";

// Optional Cloudflare integration for publishing/removing the SVCB record.
// Enabled only when both env vars are present. Without them, mark/unmark
// return the record to be published manually.

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

async function findRecord(name: string): Promise<CfRecord | null> {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const res = await fetch(`${API}/zones/${zone}/dns_records?type=SVCB&name=${encodeURIComponent(name)}`, {
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
  const name = EMBLEM_OWNER_PREFIX + fqdn.replace(/\.$/, "");
  const value = `key${EMBLEM_SVCPARAM_KEY}="${escapeCharString(emblem)}"`;
  const body = {
    type: "SVCB",
    name,
    data: { priority: 1, target: ".", value },
    ttl: 300,
  };
  const existing = await findRecord(name);
  const url = existing ? `${API}/zones/${zone}/dns_records/${existing.id}` : `${API}/zones/${zone}/dns_records`;
  const res = await fetch(url, {
    method: existing ? "PUT" : "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; errors?: unknown };
  if (!json.success) return { published: false, provider: "cloudflare", error: JSON.stringify(json.errors) };
  return { published: true, provider: "cloudflare", detail: name };
}

export async function removeEmblem(fqdn: string): Promise<DnsWriteResult> {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const name = EMBLEM_OWNER_PREFIX + fqdn.replace(/\.$/, "");
  const existing = await findRecord(name);
  if (!existing) return { published: false, provider: "cloudflare", detail: "no record found" };
  const res = await fetch(`${API}/zones/${zone}/dns_records/${existing.id}`, {
    method: "DELETE",
    headers: headers(),
  });
  const json = (await res.json()) as { success: boolean; errors?: unknown };
  if (!json.success) return { published: false, provider: "cloudflare", error: JSON.stringify(json.errors) };
  return { published: true, provider: "cloudflare", detail: `removed ${name}` };
}
