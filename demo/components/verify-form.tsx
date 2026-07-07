"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyForm({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const host = value
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/\.$/, "")
      .toLowerCase();
    if (!host) return;
    setPending(true);
    router.push(`/verify/${encodeURIComponent(host)}`);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row">
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="example.com"
        aria-label="Domain to scan for an emblem"
        className="font-mono"
      />
      <Button type="submit" disabled={pending || !value.trim()} className="shrink-0">
        {pending ? "Scanning…" : "Scan for emblem"}
      </Button>
    </form>
  );
}
