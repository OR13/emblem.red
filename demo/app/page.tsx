"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Certificate,
  Broadcast,
  MagnifyingGlass,
  SealCheck,
  ArrowRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EmblemTerminal } from "@/components/emblem-terminal";

const DRAFT_URL = "https://or13.github.io/emblem.red/draft-steele-diem-architecture-demo.html";

function Json({ data }: { data: unknown }) {
  return (
    <pre className="mt-3 max-h-80 overflow-auto border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const STEPS = [
  { icon: Certificate, n: "01", title: "Issue", body: "Hash the resource and sign a COSE hash envelope (ES256) over the digest.", ref: "cose-hash-envelope" },
  { icon: Broadcast, n: "02", title: "Mark", body: "Add key65280 to the asset's own HTTPS record, beside its normal service params.", ref: "RFC 9460 · HTTPS RR" },
  { icon: MagnifyingGlass, n: "03", title: "Discover", body: "A client already fetches this record at connection setup, so the emblem rides along.", ref: "HTTPS query" },
  { icon: SealCheck, n: "04", title: "Verify", body: "Check the COSE signature, then re-fetch the resource and re-hash it.", ref: "COSE + digest" },
];

export default function Home() {
  const [issuer, setIssuer] = useState<{ kid: string; publicJwk: Record<string, unknown> } | null>(null);
  const [fqdn, setFqdn] = useState("emblem.red");
  const [busy, setBusy] = useState<string | null>(null);

  const [issued, setIssued] = useState<unknown>(null);
  const [marked, setMarked] = useState<unknown>(null);
  const [verified, setVerified] = useState<{ valid?: boolean; error?: string } | null>(null);
  const [unmarked, setUnmarked] = useState<unknown>(null);

  const [verifySource, setVerifySource] = useState<"dns" | "emblem" | "record">("dns");
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    fetch("/api/issuer").then((r) => r.json()).then(setIssuer).catch(() => {});
  }, []);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const lastEmblemB64 = (issued as { emblem?: { base64url?: string } } | null)?.emblem?.base64url;

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-5xl items-center gap-10 px-5 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">
                IETF DIEM · digital emblems
              </p>
              <h1 className="mt-4 font-heading text-[clamp(2.6rem,6.5vw,4.75rem)] leading-[0.94] font-black tracking-[-0.03em] text-balance">
                Digital emblems, delivered over DNS.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                A digital emblem is a signed marker, discoverable in DNS, that binds a protected status
                to a resource. emblem.red signs a COSE hash envelope over the resource, carries it in the
                asset&apos;s HTTPS record, and verifies it from anywhere.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/verify" className={cn(buttonVariants({ size: "lg" }))}>
                  Verify a domain
                  <ArrowRight weight="bold" data-icon="inline-end" />
                </Link>
                <a
                  href={DRAFT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Architecture draft
                </a>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                This domain is marked.{" "}
                <Link href="/verify/emblem.red" className="text-primary underline underline-offset-4">
                  See emblem.red&apos;s own emblem
                </Link>
              </p>
            </div>

            {/* Animated verification terminal */}
            <div className="w-full min-w-0">
              <EmblemTerminal />
            </div>
          </div>
        </section>

        {/* How an emblem travels */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">How an emblem travels</h2>
            <span className="hidden font-mono text-xs text-muted-foreground sm:block">issue → mark → discover → verify</span>
          </div>
          <ol className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-3 bg-card p-6">
                <div className="flex items-center justify-between">
                  <s.icon className="h-6 w-6 text-primary" weight="duotone" />
                  <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                </div>
                <h3 className="font-heading text-lg font-bold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <span className="mt-auto font-mono text-[11px] tracking-wide text-muted-foreground/80 uppercase">
                  {s.ref}
                </span>
              </li>
            ))}
          </ol>

          {/* Worked example */}
          <div className="mt-12 border border-border">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-6 py-3">
              <h3 className="font-heading text-lg font-bold">A worked example</h3>
              <span className="font-mono text-xs text-muted-foreground">St. Stephen&apos;s Cathedral, Vienna</span>
            </div>
            <div className="grid gap-px bg-border md:grid-cols-2">
              <div className="bg-card p-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The resource is <span className="font-mono text-foreground">application/json</span> — GeoJSON that
                  marks the landmark protected. The emblem is a COSE <span className="text-foreground">hash envelope</span>{" "}
                  over those exact bytes, so it stays valid only while the resource is unchanged. CWT claims ride in the
                  protected header (RFC 9597), kept minimal: a <code>sub</code> and a <code>cnf</code> key (RFC 8747) the
                  holder can later prove possession of.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/verify/emblem.red" className={cn(buttonVariants({ size: "sm" }))}>
                    Verify this emblem
                    <ArrowRight weight="bold" data-icon="inline-end" />
                  </Link>
                  <a href="/landmarks/stephansdom.json" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    View the resource
                  </a>
                  <a href="/api/emblem?fqdn=emblem.red" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Fetch the emblem
                  </a>
                </div>
              </div>
              <div className="bg-card p-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-xs">
                  <dt className="text-muted-foreground">resource</dt>
                  <dd className="text-foreground">application/json (GeoJSON)</dd>
                  <dt className="text-muted-foreground">emblem</dt>
                  <dd className="break-all text-foreground">application/digital-emblem+cose</dd>
                  <dt className="text-muted-foreground">payload</dt>
                  <dd className="text-foreground">SHA-256 digest of the resource</dd>
                  <dt className="text-muted-foreground">headers</dt>
                  <dd className="text-foreground">258 hash-alg · 259 type · 260 location</dd>
                  <dt className="text-muted-foreground">claims</dt>
                  <dd className="text-foreground">15 CWT claims → sub · cnf</dd>
                  <dt className="text-muted-foreground">cnf</dt>
                  <dd className="text-foreground">COSE_Key (EC2 P-256) for PoP</dd>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* Instrument */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto w-full max-w-5xl px-5 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-extrabold tracking-tight">Try it live</h2>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  Issue an emblem, mark a domain in DNS, verify it, and remove it. Writes hit real DNS
                  when a Cloudflare token is configured.
                </p>
              </div>
              {issuer ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">trust anchor</span>
                  <Badge variant="secondary">kid: {issuer.kid}</Badge>
                  <Badge variant="outline">{String(issuer.publicJwk.crv)}</Badge>
                </div>
              ) : null}
            </div>

            <div className="mt-8 border border-border bg-card">
              <div className="border-b border-border p-5">
                <Label htmlFor="fqdn" className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                  Asset FQDN
                </Label>
                <Input
                  id="fqdn"
                  value={fqdn}
                  onChange={(e) => setFqdn(e.target.value)}
                  placeholder="example.com"
                  className="mt-2 font-mono"
                />
              </div>

              <Tabs defaultValue="issue" className="p-5">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="issue">Issue</TabsTrigger>
                  <TabsTrigger value="mark">Mark</TabsTrigger>
                  <TabsTrigger value="verify">Verify</TabsTrigger>
                  <TabsTrigger value="unmark">Unmark</TabsTrigger>
                </TabsList>

                <TabsContent value="issue" className="mt-5">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Sign a COSE hash envelope (ES256) over the resource digest, with CWT claims and a
                    cnf key in the protected header, and render the HTTPS record.
                  </p>
                  <Button
                    disabled={busy === "issue"}
                    onClick={() =>
                      run("issue", async () => {
                        const r = await post("/api/issue", { fqdn });
                        setIssued(r);
                        if (r.error) toast.error(r.error);
                        else toast.success(`Issued ${r.emblem.bytes}-byte emblem`);
                      })
                    }
                  >
                    {busy === "issue" ? "Issuing…" : "Issue emblem"}
                  </Button>
                  {issued != null && <Json data={issued} />}
                </TabsContent>

                <TabsContent value="mark" className="mt-5">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Publish the emblem in the asset&apos;s HTTPS record (via Cloudflare when configured,
                    otherwise emit the record to publish).
                  </p>
                  <Button
                    disabled={busy === "mark"}
                    onClick={() =>
                      run("mark", async () => {
                        const r = await post("/api/mark", { fqdn, emblem: lastEmblemB64 });
                        setMarked(r);
                        if (r.error) toast.error(r.error);
                        else if (r.marked) toast.success("Published to DNS");
                        else toast.message("Record ready to publish manually");
                      })
                    }
                  >
                    {busy === "mark" ? "Marking…" : "Mark FQDN"}
                  </Button>
                  {lastEmblemB64 && <p className="mt-2 text-xs text-muted-foreground">Using the emblem issued above.</p>}
                  {marked != null && <Json data={marked} />}
                </TabsContent>

                <TabsContent value="verify" className="mt-5">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Check the COSE signature, then re-fetch the referenced resource and re-hash it.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(["dns", "emblem", "record"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={verifySource === s ? "default" : "outline"}
                        onClick={() => setVerifySource(s)}
                      >
                        {s === "dns" ? "From DNS" : s === "emblem" ? "Paste emblem" : "Paste HTTPS record"}
                      </Button>
                    ))}
                  </div>
                  {verifySource !== "dns" && (
                    <Textarea
                      className="mb-3 font-mono text-xs"
                      rows={3}
                      placeholder={verifySource === "emblem" ? "base64url emblem…" : 'key65280="…"'}
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      disabled={busy === "verify"}
                      onClick={() =>
                        run("verify", async () => {
                          const payload =
                            verifySource === "dns"
                              ? { fqdn, source: "dns" }
                              : verifySource === "emblem"
                                ? { fqdn, source: "emblem", emblem: pasted }
                                : { fqdn, source: "record", record: pasted };
                          const r = await post("/api/verify", payload);
                          setVerified(r);
                          if (r.error) toast.error(r.error);
                          else if (r.valid) toast.success("Emblem valid");
                          else toast.error("Emblem invalid");
                        })
                      }
                    >
                      {busy === "verify" ? "Verifying…" : "Verify"}
                    </Button>
                    <Link
                      href={`/verify/${encodeURIComponent(fqdn.trim())}`}
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      Open permalink →
                    </Link>
                  </div>
                  {verified != null && (
                    <div className="mt-3">
                      {"valid" in verified && (
                        <Badge variant={verified.valid ? "default" : "destructive"}>
                          {verified.valid ? "VALID" : "INVALID"}
                        </Badge>
                      )}
                      <Json data={verified} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="unmark" className="mt-5">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Remove the emblem from the HTTPS record so none is discoverable.
                  </p>
                  <Button
                    variant="destructive"
                    disabled={busy === "unmark"}
                    onClick={() =>
                      run("unmark", async () => {
                        const r = await post("/api/unmark", { fqdn });
                        setUnmarked(r);
                        if (r.error) toast.error(r.error);
                        else if (r.unmarked) toast.success("Removed from DNS");
                        else toast.message("Manual removal instructions below");
                      })
                    }
                  >
                    {busy === "unmark" ? "Unmarking…" : "Unmark FQDN"}
                  </Button>
                  {unmarked != null && <Json data={unmarked} />}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

