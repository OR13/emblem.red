// HTTPS/SVCB (RFC 9460) delivery of a digital emblem.
//
// The emblem is carried in the asset's own ServiceMode HTTPS record (the record
// clients already fetch at connection setup), inside a private-use SvcParamKey
// (key65280, range 65280-65534), alongside the normal alpn param. There is no
// dedicated `emblem.<fqdn>` name — that would reveal interest in the emblem. On
// the wire the value is the raw COSE/CBOR octets; in presentation (zone-file)
// form arbitrary binary is escaped byte-by-byte as \DDD decimal escapes
// (RFC 9460 §2.1). We keep the key out of `mandatory` so the record degrades
// gracefully for ordinary clients, which ignore the unknown SvcParam.

import { toB64url, fromB64url } from "./emblem";
import { resolveWire, QTYPE } from "./doh";

export const EMBLEM_SVCPARAM_KEY = 65280; // private use

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

export interface HttpsRecord {
  owner: string; // the asset FQDN itself
  type: "HTTPS";
  ttl: number;
  priority: number;
  target: string;
  /** SvcParams value string carried in the record (alpn + emblem key65280). */
  value: string;
  /** zone-file presentation of just the emblem SvcParam (binary-clean, \DDD). */
  presentation: string;
  /** full zone-file line */
  zoneLine: string;
  /** authoring-convenience base64url of the same emblem bytes */
  base64url: string;
}

/**
 * Build the asset's own HTTPS(65) record carrying the emblem in key65280,
 * alongside a normal `alpn` SvcParam. This is the *only* delivery channel: the
 * emblem rides in the record clients already fetch at connection setup, so an
 * emblem lookup is indistinguishable from an ordinary client connecting. There
 * is deliberately no dedicated `emblem.<fqdn>` name — that would reveal that a
 * party is looking for an emblem.
 */
export function emblemToHttpsRecord(
  fqdn: string,
  emblem: Uint8Array,
  opts: { ttl?: number; priority?: number; target?: string; alpn?: string } = {}
): HttpsRecord {
  const ttl = opts.ttl ?? 300;
  const priority = opts.priority ?? 1; // nonzero => ServiceMode
  const target = opts.target ?? ".";
  const alpn = opts.alpn ?? "h3,h2";
  const owner = fqdn.replace(/\.$/, "");
  const presentation = `key${EMBLEM_SVCPARAM_KEY}="${escapeCharString(emblem)}"`;
  const value = `alpn="${alpn}" ${presentation}`;
  const zoneLine = `${owner}. ${ttl} IN HTTPS ${priority} ${target} ${value}`;
  return { owner, type: "HTTPS", ttl, priority, target, value, presentation, zoneLine, base64url: toB64url(emblem) };
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
  /** The owner name actually queried (always the asset FQDN). */
  qname?: string;
  /** The record type queried (always HTTPS). */
  qtype?: "HTTPS";
  transport?: "wireformat" | "json";
  raw?: unknown;
  error?: string;
}

const HTTPS_QTYPE = 65;

/** Render raw RDATA octets in RFC 3597 generic form (`\# LEN HEX`) for display. */
function toGenericForm(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0") + (i % 2 ? " " : "");
  return `\\# ${bytes.length} ${hex.trim()}`;
}

/**
 * Discover a digital emblem for `fqdn`.
 *
 * The emblem is delivered **only** in the asset's own HTTPS(65) resource
 * record (key65280) — the exact record every OS/browser already fetches at
 * connection setup. A validator issues the same query an ordinary client does,
 * so an emblem lookup is indistinguishable from a normal visit: the zone
 * operator cannot tell a protection probe from ordinary traffic, and there is
 * no dedicated name whose lookup would betray interest in the emblem.
 *
 * Transport is RFC 8484 DoH wireformat (`application/dns-message`) with EDNS
 * padding, so on-path observers see only ordinary encrypted DNS; the JSON DoH
 * API is a fallback only.
 */
export async function discoverEmblem(
  fqdn: string,
  resolver = "https://cloudflare-dns.com/dns-query"
): Promise<DohResult> {
  const asset = fqdn.replace(/\.$/, "");

  // RFC 8484 wireformat, HTTPS(65) at the asset's own name.
  try {
    const wire = await resolveWire(asset, QTYPE.HTTPS, resolver);
    if (wire.error) throw new Error(wire.error);
    if (wire.rdata) {
      const emblem = emblemFromSvcbWire(wire.rdata);
      if (emblem) return { found: true, emblem, rdata: toGenericForm(wire.rdata), qname: asset, qtype: "HTTPS", transport: "wireformat" };
      return { found: false, qname: asset, qtype: "HTTPS", transport: "wireformat", error: "HTTPS record present, but it carries no emblem" };
    }
  } catch {
    /* fall back to JSON */
  }

  // JSON DoH fallback (HTTPS record).
  try {
    const url = `${resolver}?name=${encodeURIComponent(asset)}&type=HTTPS`;
    const res = await fetch(url, { headers: { accept: "application/dns-json" }, cache: "no-store" });
    if (!res.ok) return { found: false, qname: asset, qtype: "HTTPS", error: `DoH HTTP ${res.status}` };
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    const answers = (json.Answer ?? []).filter((a) => a.type === HTTPS_QTYPE);
    for (const a of answers) {
      const emblem = emblemFromSvcbPresentation(a.data) ?? emblemFromGeneric(a.data);
      if (emblem) return { found: true, emblem, rdata: a.data, qname: asset, qtype: "HTTPS", transport: "json", raw: json };
    }
    return { found: false, qname: asset, qtype: "HTTPS", transport: "json", raw: json, error: answers.length ? "HTTPS record present, but it carries no emblem" : "no HTTPS record carrying an emblem" };
  } catch (e) {
    return { found: false, qname: asset, qtype: "HTTPS", error: (e as Error).message };
  }
}

/**
 * Some resolvers (notably Cloudflare's own DoH) return SVCB rdata in RFC 3597
 * generic form: `\# LEN HEX`. Parse the wire RDATA and extract the emblem
 * SvcParam value. Wire layout (RFC 9460 §2.2):
 *   SvcPriority (uint16) | TargetName (length-prefixed labels, 0-terminated) |
 *   *(SvcParamKey uint16 | SvcParamValueLen uint16 | SvcParamValue)
 */
function emblemFromGeneric(data: string): Uint8Array | null {
  const m = data.match(/\\#\s+(\d+)\s+([0-9a-fA-F\s]+)/);
  if (!m) return null;
  const hex = m[2].replace(/\s+/g, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return emblemFromSvcbWire(bytes);
}

/**
 * Extract the emblem SvcParam (key65280) from raw SVCB RDATA wire bytes
 * (RFC 9460 §2.2): SvcPriority (uint16) | TargetName (labels, 0-terminated) |
 * *(SvcParamKey uint16 | SvcParamValueLen uint16 | SvcParamValue).
 */
export function emblemFromSvcbWire(bytes: Uint8Array): Uint8Array | null {
  let off = 2; // skip SvcPriority
  while (off < bytes.length && bytes[off] !== 0) off += bytes[off] + 1; // TargetName labels
  off += 1; // consume the root (0) label
  while (off + 4 <= bytes.length) {
    const paramKey = (bytes[off] << 8) | bytes[off + 1];
    const len = (bytes[off + 2] << 8) | bytes[off + 3];
    off += 4;
    if (off + len > bytes.length) break;
    if (paramKey === EMBLEM_SVCPARAM_KEY) return bytes.slice(off, off + len);
    off += len;
  }
  return null;
}
