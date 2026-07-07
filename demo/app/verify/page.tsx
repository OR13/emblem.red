import Link from "next/link";
import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { VerifyForm } from "@/components/verify-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Verify an emblem — emblem.red",
  description: "Scan any domain for a DNS-delivered digital emblem and verify it.",
};

const EXAMPLES = ["emblem.red"];

export default function VerifyLanding() {
  return (
    <>
      <SiteHeader showVerify={false} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
        <header className="mb-8">
          <p className="font-mono text-xs font-medium tracking-widest text-primary uppercase">
            Verify
          </p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-balance">
            Verify a digital emblem
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Enter a domain. We fetch its <code>HTTPS</code> record over DNS-over-HTTPS, the same query a
            browser makes at connection setup, then check the emblem&apos;s COSE signature, subject
            binding, and validity window.
          </p>
        </header>

        <VerifyForm autoFocus />

        <div className="mt-4 text-sm text-muted-foreground">
          Try:{" "}
          {EXAMPLES.map((e) => (
            <Link key={e} href={`/verify/${e}`} className="font-mono text-primary underline underline-offset-4">
              {e}
            </Link>
          ))}
        </div>

        <Separator className="my-8" />
        <p className="text-xs text-muted-foreground">
          A permalink like <span className="font-mono">emblem.red/verify/example.com</span> re-runs the
          scan live on each visit. Nothing is cached.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
