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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fqdn: string }>;
}): Promise<Metadata> {
  const { fqdn } = await params;
  const host = normalizeFqdn(decodeURIComponent(fqdn));
  return {
    title: `Emblem for ${host} — emblem.red`,
    description: `DNS-delivered digital emblem verification for ${host}.`,
  };
}

// ---- small presentational helpers -----------------------------------------

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          ok ? "bg-emerald-600" : "bg-red-600"
        }`}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className={ok ? "" : "text-red-600"}>{children}</span>
    </li>
  );
}

function StatusHero({ result }: { result: ScanResult }) {
  const state = !result.found ? "none" : result.verify?.valid ? "valid" : "invalid";
  const cfg = {
    valid: { label: "VALID EMBLEM", cls: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
    invalid: { label: "INVALID EMBLEM", cls: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400" },
    none: { label: "NO EMBLEM FOUND", cls: "border-border bg-muted text-muted-foreground" },
  }[state];
  return (
    <div className={`rounded-lg border px-5 py-4 ${cfg.cls}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">{state === "valid" ? "✓" : state === "invalid" ? "✕" : "—"}</span>
        <div>
          <div className="text-lg font-semibold tracking-tight">{cfg.label}</div>
          <div className="text-sm opacity-80">
            for <span className="font-mono">{result.fqdn}</span>
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
        Carried in the asset&apos;s own <code>HTTPS</code> record (key65280), the record a browser
        already fetches at connection setup. Verifying issues the same query an ordinary client does,
        so the zone operator cannot tell a protection check from a normal visit, and no dedicated name
        exists whose lookup would reveal interest in the emblem.
      </p>
    </div>
  );
}

// ---- page ------------------------------------------------------------------

export default async function VerifyFqdnPage({ params }: { params: Promise<{ fqdn: string }> }) {
  const { fqdn } = await params;
  const result = await scanAndVerify(decodeURIComponent(fqdn));
  const claims = result.verify?.claims ?? {};
  const errors = result.verify?.errors ?? [];

  const sub = claims.sub as string | undefined;
  const { iat, nbf, exp } = result.times ?? { iat: null, nbf: null, exp: null };
  const sigOk = Boolean(result.checks?.sigOk);
  const subOk = Boolean(result.checks?.subOk);
  const windowOk = Boolean(result.checks?.windowOk);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <header className="mb-8">
        <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">
          Emblem verification
        </p>
        <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">{result.fqdn}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Queried <span className="font-mono text-foreground">{result.ownerName}</span> for {result.queryType === "HTTPS" ? "an" : "a"}{" "}
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
              <CardDescription>
                COSE signature, subject binding, and validity window against the demo trust anchor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <Check ok={sigOk}>
                  COSE_Sign1 signature valid
                  {result.verifiedWithKid && (
                    <span className="text-muted-foreground"> (kid: {result.verifiedWithKid})</span>
                  )}
                </Check>
                <Check ok={subOk}>
                  Subject binds to this FQDN (<span className="font-mono">sub = {sub ?? "—"}</span>)
                </Check>
                <Check ok={windowOk}>Within validity window (nbf / exp)</Check>
              </ul>
              {errors.length > 0 && (
                <div className="mt-4 rounded-md border border-red-600/30 bg-red-600/5 p-3 text-sm text-red-700 dark:text-red-400">
                  <div className="font-medium">Reported problems</div>
                  <ul className="mt-1 list-inside list-disc">
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Emblem claims</CardTitle>
              <CardDescription>CBOR Web Token (RFC 8392) claim set.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Issuer</dt>
                <dd className="font-mono">{String(claims.iss ?? "—")}</dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-mono">{sub ?? "—"}</dd>
                {iat && (
                  <>
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-mono">
                      {iat.iso} <span className="text-muted-foreground">({iat.rel})</span>
                    </dd>
                  </>
                )}
                {nbf && (
                  <>
                    <dt className="text-muted-foreground">Not before</dt>
                    <dd className="font-mono">
                      {nbf.iso} <span className="text-muted-foreground">({nbf.rel})</span>
                    </dd>
                  </>
                )}
                {exp && (
                  <>
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd className="font-mono">
                      {exp.iso}{" "}
                      <span className={result.expired ? "text-red-600" : "text-muted-foreground"}>
                        ({exp.rel})
                      </span>
                    </dd>
                  </>
                )}
                {claims.cti != null && (
                  <>
                    <dt className="text-muted-foreground">Token ID</dt>
                    <dd className="truncate font-mono">{String(claims.cti)}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{result.byteLength} bytes</Badge>
                <Badge variant="outline">CWT · COSE_Sign1 · ES256</Badge>
                <Badge variant="outline">HTTPS key65280</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Decoded emblem (CBOR)</CardTitle>
              <CardDescription>
                {result.byteLength} bytes of COSE_Sign1, annotated. Every octet on the wire.
              </CardDescription>
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
              <div>
                <div className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                  HTTPS rdata (resolver form)
                </div>
                <pre className="overflow-x-auto bg-muted/60 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                  {result.rdata}
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
