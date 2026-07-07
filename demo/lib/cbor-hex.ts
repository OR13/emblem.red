// CBOR "commented hex" pretty-printer, RFC-example style: each line is the raw
// hex of an item's head (and payload) with an indented structural comment.
// COSE / CWT aware: annotates tag 61 (CWT), tag 18 (COSE_Sign1), COSE header
// labels, algorithm ids, and CWT claim keys, and decodes the embedded CBOR
// carried in the protected-header and payload byte strings.

export interface HexLine {
  indent: number;
  hex: string;
  comment: string;
}

const COSE_TAGS: Record<number, string> = {
  16: "COSE_Encrypt0",
  17: "COSE_Mac0",
  18: "COSE_Sign1",
  96: "COSE_Encrypt",
  97: "COSE_Mac",
  98: "COSE_Sign",
  61: "CWT",
};
const COSE_STRUCT = new Set([16, 17, 18, 96, 97, 98]);
const COSE_HDR: Record<number, string> = {
  1: "alg",
  2: "crit",
  3: "content type",
  4: "kid",
  5: "IV",
  15: "CWT Claims", // RFC 9597
  258: "payload-hash-alg", // draft-ietf-cose-hash-envelope
  259: "preimage-ct",
  260: "location",
};
const ALG: Record<string, string> = { "-7": "ES256", "-35": "ES384", "-36": "ES512", "-8": "EdDSA" };
const HASH: Record<string, string> = { "-16": "SHA-256", "-43": "SHA-384", "-44": "SHA-512" };
const CWT_CLAIMS: Record<number, string> = {
  1: "iss",
  2: "sub",
  3: "aud",
  4: "exp",
  5: "nbf",
  6: "iat",
  7: "cti",
  8: "cnf", // RFC 8747
};
const CNF: Record<number, string> = { 1: "COSE_Key", 2: "Encrypted_COSE_Key", 3: "kid" };
const COSE_KEY: Record<number, string> = { 1: "kty", 2: "kid", 3: "alg", [-1]: "crv", [-2]: "x", [-3]: "y" };
const KTY: Record<string, string> = { "1": "OKP", "2": "EC2", "3": "RSA", "4": "Symmetric" };
const CRV: Record<string, string> = { "1": "P-256", "2": "P-384", "3": "P-521", "6": "Ed25519" };

/** Given a resolved map-key name, the key-name table for its (map) value. */
function childKeyNames(keyName?: string): Record<number, string> | undefined {
  if (keyName === "CWT Claims") return CWT_CLAIMS;
  if (keyName === "cnf") return CNF;
  if (keyName === "COSE_Key") return COSE_KEY;
  return undefined;
}
/** Given a resolved map-key name, the value-name table for its (scalar) value. */
function childValueNames(keyName?: string): Record<string, string> | undefined {
  if (keyName === "alg") return ALG;
  if (keyName === "payload-hash-alg") return HASH;
  if (keyName === "kty") return KTY;
  if (keyName === "crv") return CRV;
  return undefined;
}

function hexOf(b: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

interface WalkOpts {
  keyLabel?: string; // "sub:" etc. prepended to the comment
  role?: "protected" | "payload"; // byte string carries embedded CBOR
  valueNames?: Record<string, string>; // annotate scalar values (e.g. alg ids)
  keyNames?: Record<number, string>; // annotate integer map keys
  positions?: Record<number, "protected" | "payload">; // roles for array elements
  cwt?: boolean; // inside a CWT tag
}

class Reader {
  p = 0;
  lines: HexLine[] = [];
  constructor(public b: Uint8Array) {}

  private head() {
    const start = this.p;
    const ib = this.b[this.p++];
    const mt = ib >> 5;
    const ai = ib & 0x1f;
    let val = ai;
    if (ai === 24) val = this.b[this.p++];
    else if (ai === 25) {
      val = (this.b[this.p] << 8) | this.b[this.p + 1];
      this.p += 2;
    } else if (ai === 26) {
      val = ((this.b[this.p] << 24) | (this.b[this.p + 1] << 16) | (this.b[this.p + 2] << 8) | this.b[this.p + 3]) >>> 0;
      this.p += 4;
    } else if (ai === 27) {
      let v = 0;
      for (let i = 0; i < 8; i++) v = v * 256 + this.b[this.p + i];
      val = v;
      this.p += 8;
    } else if (ai === 31) {
      throw new Error("indefinite lengths not supported");
    }
    return { mt, val, start };
  }

  private peekKeyName(keyNames?: Record<number, string>): string | undefined {
    if (!keyNames) return undefined;
    const ib = this.b[this.p];
    const mt = ib >> 5;
    const ai = ib & 0x1f;
    if (mt !== 0 && mt !== 1) return undefined;
    let val = ai;
    if (ai === 24) val = this.b[this.p + 1];
    else if (ai === 25) val = (this.b[this.p + 1] << 8) | this.b[this.p + 2];
    const key = mt === 0 ? val : -1 - val;
    return keyNames[key];
  }

  push(indent: number, hex: string, comment: string) {
    this.lines.push({ indent, hex, comment });
  }

  walk(indent: number, opts: WalkOpts = {}) {
    const { mt, val, start } = this.head();
    const headHex = hexOf(this.b, start, this.p);
    const prefix = opts.keyLabel ? `${opts.keyLabel} ` : "";

    switch (mt) {
      case 0: {
        const name = opts.valueNames?.[String(val)];
        this.push(indent, headHex, `${prefix}${name ? `${val}  (${name})` : `unsigned(${val})`}`);
        return;
      }
      case 1: {
        const n = -1 - val;
        const name = opts.valueNames?.[String(n)];
        this.push(indent, headHex, `${prefix}${name ? `${n}  (${name})` : `negative(${n})`}`);
        return;
      }
      case 2: {
        const cStart = this.p;
        this.p += val;
        this.push(indent, headHex, `${prefix}bytes(${val})`);
        this.renderBytes(indent + 1, cStart, val, opts);
        return;
      }
      case 3: {
        const cStart = this.p;
        this.p += val;
        const text = new TextDecoder().decode(this.b.slice(cStart, cStart + val));
        this.push(indent, headHex + hexOf(this.b, cStart, cStart + val), `${prefix}text(${val})  "${text}"`);
        return;
      }
      case 4: {
        this.push(indent, headHex, `${prefix}array(${val})`);
        for (let i = 0; i < val; i++) {
          this.walk(indent + 1, { role: opts.positions?.[i], cwt: opts.cwt });
        }
        return;
      }
      case 5: {
        this.push(indent, headHex, `${prefix}map(${val})`);
        for (let i = 0; i < val; i++) {
          const keyName = this.peekKeyName(opts.keyNames);
          this.walk(indent + 1);
          this.walk(indent + 2, {
            keyLabel: keyName ? `${keyName}:` : undefined,
            valueNames: childValueNames(keyName),
            keyNames: childKeyNames(keyName),
          });
        }
        return;
      }
      case 6: {
        const tagName = COSE_TAGS[val];
        this.push(indent, headHex, `${prefix}tag(${val})${tagName ? `  ${tagName}` : ""}`);
        this.walk(indent + 1, {
          cwt: opts.cwt || val === 61,
          positions: COSE_STRUCT.has(val) ? { 0: "protected", 2: "payload" } : undefined,
        });
        return;
      }
      default: {
        const simple = { 20: "false", 21: "true", 22: "null", 23: "undefined" }[val] ?? `simple(${val})`;
        this.push(indent, headHex, `${prefix}${simple}`);
        return;
      }
    }
  }

  /** Render a byte string's content: embedded CBOR when it carries structure, else raw hex. */
  private renderBytes(indent: number, start: number, len: number, opts: WalkOpts) {
    const content = this.b.subarray(start, start + len);
    if (len === 0) return;
    if (opts.role === "protected" || opts.role === "payload") {
      const keyNames = opts.role === "protected" ? COSE_HDR : opts.cwt ? CWT_CLAIMS : undefined;
      try {
        const sub = new Reader(content);
        sub.walk(indent, { keyNames });
        if (sub.p === content.length) {
          for (const l of sub.lines) this.lines.push(l);
          return;
        }
      } catch {
        /* fall through to raw */
      }
    }
    // raw content, wrapped
    const perLine = 24;
    for (let i = 0; i < content.length; i += perLine) {
      this.push(indent, hexOf(content, i, Math.min(i + perLine, content.length)), i === 0 ? "content" : "");
    }
  }
}

/** Annotated, indented commented-hex lines for a CBOR item (falls back to raw). */
export function commentedHex(bytes: Uint8Array): HexLine[] {
  const r = new Reader(bytes);
  try {
    r.walk(0);
    if (r.p !== bytes.length) r.push(0, hexOf(bytes, r.p, bytes.length), "trailing bytes");
    return r.lines;
  } catch {
    return [{ indent: 0, hex: hexOf(bytes, 0, bytes.length), comment: "raw (could not parse as CBOR)" }];
  }
}

/** Full hex grouped into byte pairs, wrapped at `perLine` bytes. */
export function groupedHex(bytes: Uint8Array, perLine = 16): string {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += perLine) {
    let row = "";
    for (let j = i; j < Math.min(i + perLine, bytes.length); j++) row += bytes[j].toString(16).padStart(2, "0") + " ";
    rows.push(row.trimEnd());
  }
  return rows.join("\n");
}
