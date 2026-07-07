// RFC 8484 DNS-over-HTTPS wireformat client.
//
// Why wireformat and not the JSON DoH API: operating systems and browsers
// (Chrome, Firefox, Safari / Apple) speak DoH in the `application/dns-message`
// wireformat of RFC 8484. The JSON API (`application/dns-json`) is a
// provider-specific convenience used by scripts, and is itself a fingerprint.
// Speaking wireformat, with a zero query id (RFC 8484 §4.1), EDNS(0) padding
// (RFC 7830 / 8467), and a mainstream resolver, makes an emblem lookup look
// like ordinary encrypted-DNS connection-setup traffic to an on-path observer.

const SVCB_TYPE = 64;
const HTTPS_TYPE = 65;
export const QTYPE = { SVCB: SVCB_TYPE, HTTPS: HTTPS_TYPE } as const;

const DEFAULT_RESOLVER = "https://cloudflare-dns.com/dns-query";

function encodeName(name: string): number[] {
  const out: number[] = [];
  for (const label of name.replace(/\.$/, "").split(".")) {
    const b = new TextEncoder().encode(label);
    if (b.length > 63) throw new Error("label too long");
    out.push(b.length, ...b);
  }
  out.push(0);
  return out;
}

/** Build a DoH query message: RD set, one question, an EDNS(0) OPT with padding to a 128-byte multiple. */
function encodeQuery(name: string, qtype: number): Uint8Array {
  const header = [0, 0, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 1]; // id=0, RD=1, qd=1, ar=1 (OPT)
  const question = [...encodeName(name), (qtype >> 8) & 0xff, qtype & 0xff, 0x00, 0x01]; // QTYPE, QCLASS IN

  // EDNS(0) OPT without RDATA yet, so we can size the padding option.
  const optFixed = [0, 0, 41, 0x04, 0xd0, 0, 0, 0, 0]; // root name, TYPE=41, UDP=1232, ext-rcode/ver/flags=0
  const preLen = header.length + question.length + optFixed.length + 2; // +2 for RDLEN
  const padHeader = 4; // OPTION-CODE(2) + OPTION-LENGTH(2)
  const target = Math.ceil((preLen + padHeader) / 128) * 128;
  const padLen = Math.max(0, target - (preLen + padHeader));
  const rdlen = padHeader + padLen;
  const opt = [
    ...optFixed,
    (rdlen >> 8) & 0xff, rdlen & 0xff,
    0x00, 0x0c, // OPTION-CODE 12 = Padding
    (padLen >> 8) & 0xff, padLen & 0xff,
    ...new Array(padLen).fill(0),
  ];
  const arr = [...header, ...question, ...opt];
  const out = new Uint8Array(new ArrayBuffer(arr.length));
  out.set(arr);
  return out;
}

/** Skip a (possibly compressed) domain name; return the offset just past it. */
function skipName(b: Uint8Array, off: number): number {
  while (off < b.length) {
    const len = b[off];
    if (len === 0) return off + 1;
    if ((len & 0xc0) === 0xc0) return off + 2; // compression pointer
    off += len + 1;
  }
  return off;
}

/** Parse the response and return the RDATA of the first answer of `qtype`. */
function firstRdataOfType(b: Uint8Array, qtype: number): Uint8Array | null {
  const qd = (b[4] << 8) | b[5];
  const an = (b[6] << 8) | b[7];
  let off = 12;
  for (let i = 0; i < qd; i++) off = skipName(b, off) + 4; // name + QTYPE + QCLASS
  for (let i = 0; i < an; i++) {
    off = skipName(b, off);
    const type = (b[off] << 8) | b[off + 1];
    const rdlen = (b[off + 8] << 8) | b[off + 9];
    const rdStart = off + 10;
    if (type === qtype) return b.subarray(rdStart, rdStart + rdlen);
    off = rdStart + rdlen;
  }
  return null;
}

export interface DohWireResult {
  rdata?: Uint8Array;
  rcode: number;
  error?: string;
}

/** Resolve one record type over DoH wireformat; returns the first matching RDATA. */
export async function resolveWire(
  name: string,
  qtype: number,
  resolver = DEFAULT_RESOLVER
): Promise<DohWireResult> {
  const query = encodeQuery(name, qtype);
  const res = await fetch(resolver, {
    method: "POST",
    headers: { "content-type": "application/dns-message", accept: "application/dns-message" },
    // Uint8Array is a valid fetch body at runtime; the DOM lib type is
    // over-strict about SharedArrayBuffer-backed views.
    body: query as unknown as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) return { rcode: -1, error: `DoH HTTP ${res.status}` };
  const buf = new Uint8Array(await res.arrayBuffer());
  const rcode = buf[3] & 0x0f;
  const rdata = firstRdataOfType(buf, qtype) ?? undefined;
  return { rdata, rcode };
}
