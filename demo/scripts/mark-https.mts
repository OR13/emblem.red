// Prototype: publish an emblem in the asset's own apex HTTPS(65) record, so a
// validator's DNS query is indistinguishable from an ordinary client connecting.
// The emblem rides in key65280 alongside a normal alpn SvcParam.
//   usage: npx tsx scripts/mark-https.mts [assetFqdn]   (default protected.emblem.red)
import { issueEmblem, verifyEmblem, type IssuerKey } from "../lib/emblem.ts";
import { escapeCharString, EMBLEM_SVCPARAM_KEY } from "../lib/svcb.ts";

const FQDN = process.argv[2] ?? "protected.emblem.red";
const YEAR = 365 * 24 * 3600;
const API = "https://api.cloudflare.com/client/v4";
const zone = process.env.CLOUDFLARE_ZONE_ID!;
const token = process.env.CLOUDFLARE_API_TOKEN!;
if (!zone || !token) throw new Error("CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set");
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const privateJwk: JsonWebKey = {
  kty: "EC", crv: "P-256",
  x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk",
  y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo",
  d: "mlbmSJUK4hUceTO9IRBmVlhO5GT_1-1dufOsCvDrDS0",
};
const key: IssuerKey = {
  privateJwk,
  publicJwk: { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y },
  kid: "emblem-demo-1",
};

const now = Math.floor(Date.now() / 1000);
const emblem = await issueEmblem({ sub: FQDN, exp: now + YEAR }, key);
const selfV = await verifyEmblem(emblem, key.publicJwk, { expectedFqdn: FQDN });
console.log(`issued ${emblem.length}-byte emblem for ${FQDN}, self-verify=${selfV.valid}`);

// The emblem rides alongside a normal alpn param in the asset's own HTTPS record.
const value = `alpn="h3,h2" key${EMBLEM_SVCPARAM_KEY}="${escapeCharString(emblem)}"`;
const body = { type: "HTTPS", name: FQDN, data: { priority: 1, target: ".", value }, ttl: 300 };

const list = (await (await fetch(`${API}/zones/${zone}/dns_records?type=HTTPS&name=${encodeURIComponent(FQDN)}`, { headers: H })).json()) as { result?: Array<{ id: string }> };
const existing = list.result?.[0]?.id;
const url = existing ? `${API}/zones/${zone}/dns_records/${existing}` : `${API}/zones/${zone}/dns_records`;
const res = await fetch(url, { method: existing ? "PUT" : "POST", headers: H, body: JSON.stringify(body) });
const j = (await res.json()) as { success: boolean; errors?: unknown; result?: { id: string; content?: string } };
console.log(`publish HTTPS record HTTP ${res.status} success=${j.success} ${existing ? "(updated)" : "(created)"}`);
if (!j.success) { console.error(JSON.stringify(j.errors)); process.exit(1); }
console.log(`content: ${j.result?.content?.slice(0, 80)}…`);
console.log(`marked ${FQDN} via apex HTTPS channel. Verify: /verify/${FQDN}`);
