"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./emblem-terminal.module.css";

// A dependency-free animated terminal that actually retrieves the resource.
// Fixed height + overflow:hidden + pointer-events:none: it can never reflow the
// page or capture scroll.

const RESOURCE_PATH = "/landmarks/stephansdom.json";

type Seg = { text: string; cls?: string };
type Line = { cmd: string } | { segs: Seg[] };

interface Landmark {
  name: string;
  protected: boolean;
  coords?: [number, number];
}

function buildSession(lm: Landmark): Line[] {
  const coords = lm.coords ? `${lm.coords[1].toFixed(4)}, ${lm.coords[0].toFixed(4)}` : "—";
  return [
    { segs: [{ text: "# is this landmark protected?", cls: styles.dim }] },
    { segs: [{ text: "" }] },
    { cmd: "emblem verify emblem.red" },
    { segs: [{ text: "  ↳ HTTPS record · DoH", cls: styles.dim }] },
    { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "COSE_Sign1 · ES256" }] },
    { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "hash envelope · SHA-256" }] },
    { segs: [{ text: "  ↳ GET stephansdom.json", cls: styles.dim }] },
    { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "digest matches payload" }] },
    { segs: [{ text: "    name: ", cls: styles.dim }, { text: lm.name }] },
    { segs: [{ text: "    coords: ", cls: styles.dim }, { text: coords }] },
    { segs: [{ text: "    protected: ", cls: styles.dim }, { text: String(lm.protected), cls: lm.protected ? styles.green : styles.red }] },
    { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "cnf holder key present" }] },
    { segs: [{ text: "  ● PROTECTED", cls: styles.boldGreen }] },
  ];
}

const FALLBACK: Landmark = { name: "St. Stephen's Cathedral", protected: true, coords: [16.3735, 48.2085] };

function Prompt() {
  return <span className={styles.dim}>{"$ "}</span>;
}

function renderLine(line: Line, key: number) {
  if ("cmd" in line) {
    return (
      <div key={key} className={styles.line}>
        <Prompt />
        {line.cmd}
      </div>
    );
  }
  return (
    <div key={key} className={styles.line}>
      {line.segs.map((s, i) => (
        <span key={i} className={s.cls}>
          {s.text}
        </span>
      ))}
    </div>
  );
}

export function EmblemTerminal() {
  const started = useRef(false);
  const [done, setDone] = useState<Line[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (started.current) return; // guard React StrictMode double-invoke
    started.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function loadLandmark(): Promise<Landmark> {
      try {
        const r = await fetch(RESOURCE_PATH, { cache: "no-store" });
        if (!r.ok) return FALLBACK;
        const j = await r.json();
        const p = j?.properties ?? {};
        return {
          name: p.name ?? FALLBACK.name,
          protected: Boolean(p.protected),
          coords: Array.isArray(j?.geometry?.coordinates) ? j.geometry.coordinates : FALLBACK.coords,
        };
      } catch {
        return FALLBACK;
      }
    }

    (async () => {
      const session = buildSession(await loadLandmark());
      if (reduced) {
        setDone(session);
        setFinished(true);
        return;
      }
      await wait(350);
      for (const line of session) {
        if ("cmd" in line) {
          for (let c = 0; c <= line.cmd.length; c++) {
            setTyping(line.cmd.slice(0, c));
            await wait(18 + Math.random() * 24);
          }
          setTyping(null);
          setDone((d) => [...d, line]);
          await wait(320);
        } else {
          await wait(140);
          setDone((d) => [...d, line]);
        }
      }
      setFinished(true);
    })();

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={styles.terminal} role="img" aria-label="Terminal: verifying whether a domain is protected">
      {done.map((line, i) => renderLine(line, i))}
      {typing !== null && (
        <div className={styles.line}>
          <Prompt />
          {typing}
          <span className={styles.cursor} />
        </div>
      )}
      {finished && (
        <div className={styles.line}>
          <Prompt />
          <span className={styles.cursor} />
        </div>
      )}
    </div>
  );
}
