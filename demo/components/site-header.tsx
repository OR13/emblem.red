"use client";

import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";

const REPO_URL = "https://github.com/OR13/emblem.red";

export function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 no-underline" aria-label="emblem.red home">
      <BrandMark className="h-8 w-8" />
      <span className="font-heading text-lg font-extrabold tracking-tight">emblem.red</span>
    </Link>
  );
}

export function SiteHeader({ showVerify = true }: { showVerify?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5">
        <Wordmark />
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <a
            href="https://datatracker.ietf.org/group/diem/about/"
            target="_blank"
            rel="noreferrer"
            className="hidden px-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            DIEM WG
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Contribute on GitHub"
            className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubLogo className="h-5 w-5" weight="fill" />
          </a>
          <ThemeToggle />
          {showVerify && (
            <Link href="/verify" className={cn(buttonVariants({ size: "sm" }))}>
              Verify
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
