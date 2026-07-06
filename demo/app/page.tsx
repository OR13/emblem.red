"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const DRAFT_URL = "https://or13.github.io/emblem.red/draft-steele-diem-architecture-demo.html";

function Json({ data }: { data: unknown }) {
  return (
    <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
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

export default function Home() {
  const [issuer, setIssuer] = useState<{ kid: string; publicJwk: Record<string, unknown> } | null>(null);
  const [fqdn, setFqdn] = useState("target.emblem.red");
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
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-600 text-lg font-bold text-white">
            +
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">emblem.red</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Issue, verify, mark, and unmark DNS names with a{" "}
          <span className="font-medium text-foreground">CWT-based digital emblem</span> delivered entirely over
          DNS SVCB queries.
        </p>
        <a
          href={DRAFT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-red-600 underline underline-offset-4"
        >
          draft-steele-diem-architecture-demo →
        </a>
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trust anchor (demo issuer)</CardTitle>
          <CardDescription>
            The out-of-band key a Validator uses to check the COSE signature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issuer ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">kid: {issuer.kid}</Badge>
              <Badge variant="outline">{String(issuer.publicJwk.crv)}</Badge>
              <code className="truncate text-xs text-muted-foreground">
                x={String(issuer.publicJwk.x).slice(0, 24)}…
              </code>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">loading…</span>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <Label htmlFor="fqdn">Asset FQDN</Label>
        <Input
          id="fqdn"
          value={fqdn}
          onChange={(e) => setFqdn(e.target.value)}
          placeholder="target.emblem.red"
          className="mt-1.5 font-mono"
        />
      </div>

      <Tabs defaultValue="issue">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="issue">Issue</TabsTrigger>
          <TabsTrigger value="mark">Mark</TabsTrigger>
          <TabsTrigger value="verify">Verify</TabsTrigger>
          <TabsTrigger value="unmark">Unmark</TabsTrigger>
        </TabsList>

        <TabsContent value="issue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue an emblem</CardTitle>
              <CardDescription>
                Sign a CWT (COSE_Sign1, ES256) with <code>sub</code> = the FQDN, and render the SVCB record.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mark">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mark the FQDN</CardTitle>
              <CardDescription>
                Publish the SVCB record in DNS (via Cloudflare when configured, otherwise emit the record to
                publish).
              </CardDescription>
            </CardHeader>
            <CardContent>
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
              {lastEmblemB64 && (
                <p className="mt-2 text-xs text-muted-foreground">Using the emblem issued above.</p>
              )}
              {marked != null && <Json data={marked} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verify an emblem</CardTitle>
              <CardDescription>Check the signature, validity window, and that sub == FQDN.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["dns", "emblem", "record"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={verifySource === s ? "default" : "outline"}
                    onClick={() => setVerifySource(s)}
                  >
                    {s === "dns" ? "From DNS" : s === "emblem" ? "Paste emblem" : "Paste SVCB record"}
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
                    else if (r.valid) toast.success("Emblem valid ✓");
                    else toast.error("Emblem invalid");
                  })
                }
              >
                {busy === "verify" ? "Verifying…" : "Verify"}
              </Button>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unmark">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unmark the FQDN</CardTitle>
              <CardDescription>Remove the SVCB record so no emblem is discoverable.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="my-8" />
      <footer className="text-xs text-muted-foreground">
        A demonstration companion to draft-steele-diem-architecture-demo. Emblems are CBOR Web Tokens (RFC 8392)
        protected with COSE (RFC 9052) and delivered over SVCB records (RFC 9460). Not for production use.
      </footer>
    </main>
  );
}
