// Mark a domain by publishing a COSE hash-envelope emblem in its own HTTPS
// record (key65280). The emblem hashes the committed resource and carries a
// cnf holder key. usage: npx tsx scripts/mark-https.mts [assetFqdn]
import { readFileSync } from "node:fs";
import { issueHashEmblem, verifyEmblem, type IssuerKey } from "../lib/emblem.ts";
import { emblemToHttpsRecord } from "../lib/svcb.ts";
import { RESOURCE_CONTENT_TYPE, RESOURCE_LOCATION } from "../lib/resource.ts";

const FQDN = process.argv[2] ?? "emblem.red";
const API = "https://api.cloudflare.com/client/v4";
const zone = process.env.CLOUDFLARE_ZONE_ID!;
const token = process.env.CLOUDFLARE_API_TOKEN!;
if (!zone || !token) throw new Error("CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set");
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const issuer: IssuerKey = {
  privateJwk: {
    kty: "EC", crv: "P-256",
    x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk",
    y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo",
    d: "mlbmSJUK4hUceTO9IRBmVlhO5GT_1-1dufOsCvDrDS0",
  },
  publicJwk: { kty: "EC", crv: "P-256", x: "Lk_JG6KJvF5bP79Wgs5cDlfUuwDDXHfepyk2vNpA_Jk", y: "WkqmDWYEhA0uejZCXPAaiIHQ5JCjVh17ownpn0g4Iwo" },
  kid: "emblem-demo-1",
};
const holderPublicJwk = { kty: "EC", crv: "P-256", x: "XLGv7xfBaFtPu9kq5Dv9EWDORjxnsc9l7bqc1zMJCqA", y: "DzKTaiV4sSTiPMvN_n_YsZybjsSLH_C8w3WHU-t7akQ" };

// Hash the committed resource bytes (identical to what the site serves).
const resource = new Uint8Array(readFileSync(new URL("../public/landmarks/stephansdom.json", import.meta.url)));
const emblem = await issueHashEmblem(
  { resource, contentType: RESOURCE_CONTENT_TYPE, location: RESOURCE_LOCATION, sub: RESOURCE_LOCATION, holderPublicJwk, holderKid: "holder-demo-1" },
  issuer
);
const v = await verifyEmblem(emblem, issuer.publicJwk);
console.log(`issued ${emblem.length}-byte hash-envelope emblem; sig=${v.valid}; hashAlg=${v.hashAlgName}; location=${v.location}`);

const rec = emblemToHttpsRecord(FQDN, emblem);
const body = { type: "HTTPS", name: FQDN, data: { priority: rec.priority, target: rec.target, value: rec.value }, ttl: 300 };
const list = (await (await fetch(`${API}/zones/${zone}/dns_records?type=HTTPS&name=${encodeURIComponent(FQDN)}`, { headers: H })).json()) as { result?: Array<{ id: string }> };
const existing = list.result?.[0]?.id;
const url = existing ? `${API}/zones/${zone}/dns_records/${existing}` : `${API}/zones/${zone}/dns_records`;
const res = await fetch(url, { method: existing ? "PUT" : "POST", headers: H, body: JSON.stringify(body) });
const j = (await res.json()) as { success: boolean; errors?: unknown };
console.log(`publish HTTPS record HTTP ${res.status} success=${j.success} ${existing ? "(updated)" : "(created)"}`);
if (!j.success) { console.error(JSON.stringify(j.errors)); process.exit(1); }
console.log(`marked ${FQDN}. Verify: /verify/${FQDN}`);
