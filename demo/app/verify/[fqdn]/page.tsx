import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VerifyForm } from "@/components/verify-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { scanAndVerify, normalizeFqdn, type ScanResult } from "@/lib/verify-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ fqdn: string }> }): Promise<Metadata> {
  const { fqdn } = await params;
  const host = normalizeFqdn(decodeURIComponent(fqdn));
  return {
    title: `Emblem for ${host} — emblem.red`,
    description: `DNS-delivered digital emblem verification for ${host}.`,
  };
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? "bg-emerald-600" : "bg-red-600"}`}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className={ok ? "" : "text-red-600"}>{children}</span>
    </li>
  );
}

function StatusHero({ result }: { result: ScanResult }) {
  const state = !result.found ? "none" : result.checks?.sigOk && result.checks?.hashOk ? "valid" : "invalid";
  const cfg = {
    valid: { label: "PROTECTED", cls: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400", mark: "✓" },
    invalid: { label: "EMBLEM INVALID", cls: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400", mark: "✕" },
    none: { label: "NOT PROTECTED", cls: "border-border bg-muted text-muted-foreground", mark: "—" },
  }[state];
  return (
    <div className={`rounded-lg border px-5 py-4 ${cfg.cls}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">{cfg.mark}</span>
        <div>
          <div className="text-lg font-semibold tracking-tight">{cfg.label}</div>
          <div className="text-sm opacity-80">
            <span className="font-mono">{result.fqdn}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyNote({ name }: { name: string }) {
  return (
    <div className="mt-3 border border-border bg-muted/40 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs tracking-wider text-primary uppercase">apex HTTPS record</span>
        <span className="font-mono text-xs text-muted-foreground">{name}</span>
      </div>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Carried in the asset&apos;s own <code>HTTPS</code> record (key65280), the record a browser already
        fetches at connection setup. Verifying issues the same query an ordinary client does, so the zone
        operator cannot tell a protection check from a normal visit.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono break-all">{children}</dd>
    </>
  );
}

export default async function VerifyFqdnPage({ params }: { params: Promise<{ fqdn: string }> }) {
  const { fqdn } = await params;
  const result = await scanAndVerify(decodeURIComponent(fqdn));
  const sigOk = Boolean(result.checks?.sigOk);
  const hashOk = Boolean(result.checks?.hashOk);
  const res = result.resource;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <header className="mb-8">
          <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">Emblem verification</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">{result.fqdn}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Queried <span className="font-mono text-foreground">{result.ownerName}</span> for an{" "}
            <code>{result.queryType ?? "HTTPS"}</code> record over DNS-over-HTTPS.
          </p>
        </header>

        <StatusHero result={result} />
        {result.found && <PrivacyNote name={result.ownerName} />}

        {!result.found && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">No emblem in DNS</CardTitle>
              <CardDescription>
                No emblem was discoverable in the <code>HTTPS</code> record for{" "}
                <span className="font-mono">{result.ownerName}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {result.discoveryError ?? "The asset has no HTTPS record carrying an emblem."}
            </CardContent>
          </Card>
        )}

        {result.found && (
          <>
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Verification checks</CardTitle>
                <CardDescription>COSE signature, then re-hash of the referenced resource.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <Check ok={sigOk}>
                    COSE_Sign1 signature valid
                    {result.verifiedWithKid && <span className="text-muted-foreground"> (kid: {result.verifiedWithKid})</span>}
                  </Check>
                  <Check ok={hashOk}>
                    Resource hash matches the signed payload
                    {res?.fetched && res.bytes != null && (
                      <span className="text-muted-foreground"> ({res.bytes} B, {res.contentType})</span>
                    )}
                    {res && !res.fetched && <span className="text-muted-foreground"> (resource unreachable: {res.error})</span>}
                  </Check>
                </ul>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-4 rounded-md border border-red-600/30 bg-red-600/5 p-3 text-sm text-red-700 dark:text-red-400">
                    <ul className="list-inside list-disc">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hash envelope</CardTitle>
                <CardDescription>draft-ietf-cose-hash-envelope — the payload is a hash of an external resource.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <Row label="Media type">{result.mediaType}</Row>
                  <Row label="Hash alg">{result.hashAlgName}</Row>
                  <Row label="Preimage type">{result.preimageContentType}</Row>
                  <Row label="Location">
                    <a href={result.location} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                      {result.location}
                    </a>
                  </Row>
                  <Row label="Payload hash">{result.payloadHashHex}</Row>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{result.byteLength} bytes</Badge>
                  <Badge variant="outline">COSE_Sign1 · ES256</Badge>
                  <Badge variant="outline">HTTPS key65280</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CWT claims &amp; holder key</CardTitle>
                <CardDescription>RFC 9597 claims in the protected header; a cnf key (RFC 8747) for proof of possession.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <Row label="sub">{result.sub ?? "—"}</Row>
                  <Row label="cnf kty">{result.cnf ? "EC2 · P-256" : "—"}</Row>
                  {result.cnf?.kid && <Row label="cnf kid">{result.cnf.kid}</Row>}
                  {result.cnf && <Row label="cnf x">{result.cnf.jwk.x}</Row>}
                  {result.cnf && <Row label="cnf y">{result.cnf.jwk.y}</Row>}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  The holder of the matching private key can present proof of possession of this key in the future.
                </p>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Decoded emblem (CBOR)</CardTitle>
                <CardDescription>{result.byteLength} bytes of COSE_Sign1, annotated. Every octet on the wire.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto bg-muted/60 p-4 font-mono text-[11px] leading-relaxed">
                  {result.cbor?.map((l, i) => (
                    <div key={i} style={{ paddingLeft: `${l.indent * 1.1}rem` }}>
                      <span className="text-foreground">{l.hex}</span>
                      {l.comment && <span className="text-muted-foreground">{"  # "}{l.comment}</span>}
                    </div>
                  ))}
                </pre>
              </CardContent>
            </Card>

            <details className="mt-4 border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Raw bytes</summary>
              <div className="space-y-4 px-4 pb-4">
                <div>
                  <div className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">Hex</div>
                  <pre className="overflow-x-auto bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">{result.hex}</pre>
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">base64url</div>
                  <pre className="overflow-x-auto bg-muted/60 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                    {result.base64url}
                  </pre>
                </div>
              </div>
            </details>
          </>
        )}

        <Separator className="my-8" />
        <div>
          <div className="mb-2 text-sm font-medium">Scan another domain</div>
          <VerifyForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
