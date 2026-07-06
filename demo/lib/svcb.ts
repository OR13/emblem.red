// SVCB (RFC 9460) delivery of a digital emblem.
//
// The emblem is carried in a ServiceMode SVCB record at owner name
// `emblem.<fqdn>`, inside a private-use SvcParamKey (key65280, range
// 65280-65534). On the wire the value is the raw COSE/CBOR octets; in
// presentation (zone-file) form arbitrary binary is escaped byte-by-byte as
// \DDD decimal escapes (RFC 9460 §2.1). We keep the key out of `mandatory`
// so records degrade gracefully for non-DIEM consumers.

import { toB64url, fromB64url } from "./emblem";

export const EMBLEM_SVCPARAM_KEY = 65280; // private use
export const EMBLEM_OWNER_PREFIX = "emblem.";
const SVCB_QTYPE = 64;

// ---- DNS presentation char-string escaping (RFC 1035 §5.1 / RFC 9460 App A)

/** Escape raw octets into a quoted DNS char-string with \DDD for binary. */
export function escapeCharString(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    // Safe printable ASCII, excluding '"' (0x22) and '\' (0x5c).
    if (b >= 0x21 && b <= 0x7e && b !== 0x22 && b !== 0x5c) {
      out += String.fromCharCode(b);
    } else {
      out += "\\" + b.toString().padStart(3, "0");
    }
  }
  return out;
}

/** Reverse escapeCharString: parse a DNS char-string body into raw octets. */
export function unescapeCharString(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const next = s.slice(i + 1, i + 4);
      if (/^\d{3}$/.test(next)) {
        out.push(parseInt(next, 10));
        i += 3;
      } else {
        // \X -> literal X
        out.push(s.charCodeAt(i + 1));
        i += 1;
      }
    } else {
      out.push(c.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

// ---- record construction ---------------------------------------------------

export interface SvcbRecord {
  owner: string; // emblem.<fqdn>
  type: "SVCB";
  ttl: number;
  priority: number;
  target: string;
  /** zone-file presentation of the SvcParams value (binary-clean, \DDD) */
  presentation: string;
  /** full zone-file line */
  zoneLine: string;
  /** authoring-convenience base64url of the same emblem bytes */
  base64url: string;
}

export function emblemToSvcbRecord(
  fqdn: string,
  emblem: Uint8Array,
  opts: { ttl?: number; priority?: number; target?: string } = {}
): SvcbRecord {
  const ttl = opts.ttl ?? 300;
  const priority = opts.priority ?? 1; // nonzero => ServiceMode
  const target = opts.target ?? ".";
  const owner = EMBLEM_OWNER_PREFIX + fqdn.replace(/\.$/, "");
  const escaped = escapeCharString(emblem);
  const presentation = `key${EMBLEM_SVCPARAM_KEY}="${escaped}"`;
  const zoneLine = `${owner}. ${ttl} IN SVCB ${priority} ${target} ${presentation}`;
  return {
    owner,
    type: "SVCB",
    ttl,
    priority,
    target,
    presentation,
    zoneLine,
    base64url: toB64url(emblem),
  };
}

// ---- parsing an SVCB rdata presentation for the emblem ---------------------

/**
 * Extract the emblem octets from an SVCB rdata presentation string such as
 * `1 . key65280="...\DDD..."`. Also accepts a base64url alternate form
 * `key65280.b64="..."` for legibility. Returns null if the key is absent.
 */
export function emblemFromSvcbPresentation(rdata: string): Uint8Array | null {
  // base64url alternate
  const b64m = rdata.match(new RegExp(`key${EMBLEM_SVCPARAM_KEY}\\.b64="([^"]*)"`));
  if (b64m) return fromB64url(b64m[1]);
  // quoted char-string (default, binary-clean)
  const m = rdata.match(new RegExp(`key${EMBLEM_SVCPARAM_KEY}="((?:[^"\\\\]|\\\\.)*)"`));
  if (m) return unescapeCharString(m[1]);
  return null;
}

// ---- DNS-over-HTTPS discovery ---------------------------------------------

export interface DohResult {
  found: boolean;
  emblem?: Uint8Array;
  rdata?: string;
  raw?: unknown;
  error?: string;
}

/**
 * Query DNS-over-HTTPS for the SVCB record at emblem.<fqdn> and extract the
 * emblem. Uses Cloudflare's JSON DoH endpoint by default.
 */
export async function discoverEmblem(
  fqdn: string,
  resolver = "https://cloudflare-dns.com/dns-query"
): Promise<DohResult> {
  const name = EMBLEM_OWNER_PREFIX + fqdn.replace(/\.$/, "");
  const url = `${resolver}?name=${encodeURIComponent(name)}&type=SVCB`;
  try {
    const res = await fetch(url, { headers: { accept: "application/dns-json" } });
    if (!res.ok) return { found: false, error: `DoH HTTP ${res.status}` };
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    const answers = (json.Answer ?? []).filter((a) => a.type === SVCB_QTYPE);
    for (const a of answers) {
      const emblem = emblemFromSvcbPresentation(a.data) ?? emblemFromGeneric(a.data);
      if (emblem) return { found: true, emblem, rdata: a.data, raw: json };
    }
    return { found: false, raw: json, error: answers.length ? "no emblem SvcParam in record" : "no SVCB record" };
  } catch (e) {
    return { found: false, error: (e as Error).message };
  }
}

/** Some resolvers return SVCB rdata in RFC 3597 generic form: `\# LEN HEX`. */
function emblemFromGeneric(data: string): Uint8Array | null {
  const m = data.match(/\\#\s+\d+\s+([0-9a-fA-F\s]+)/);
  if (!m) return null;
  const hex = m[1].replace(/\s+/g, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  // Generic form encodes the whole RDATA; locating the SvcParam inside is
  // resolver-specific, so we only surface it for debugging.
  return null;
}
