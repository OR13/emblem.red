"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./emblem-terminal.module.css";

// A dependency-free animated terminal. Fixed height + overflow:hidden +
// pointer-events:none means it can never reflow the page or capture scroll.

type Seg = { text: string; cls?: string };
type Line = { cmd: string } | { segs: Seg[] };

const SESSION: Line[] = [
  { segs: [{ text: "# is this landmark protected?", cls: styles.dim }] },
  { segs: [{ text: "" }] },
  { cmd: "emblem verify emblem.red" },
  { segs: [{ text: "  ↳ HTTPS record · DoH", cls: styles.dim }] },
  { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "COSE_Sign1 · ES256" }] },
  { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "hash envelope · SHA-256" }] },
  { segs: [{ text: "  ↳ GET stephansdom.json", cls: styles.dim }] },
  { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "digest matches payload" }] },
  { segs: [{ text: "  ✓ ", cls: styles.green }, { text: "cnf holder key present" }] },
  { segs: [{ text: "  ● PROTECTED", cls: styles.boldGreen }, { text: "  Stephansdom" }] },
  { segs: [{ text: "" }] },
];

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

    (async () => {
      if (reduced) {
        setDone(SESSION);
        setFinished(true);
        return;
      }
      await wait(350);
      for (const line of SESSION) {
        if ("cmd" in line) {
          for (let c = 0; c <= line.cmd.length; c++) {
            setTyping(line.cmd.slice(0, c));
            await wait(18 + Math.random() * 24);
          }
          setTyping(null);
          setDone((d) => [...d, line]);
          await wait(320);
        } else {
          await wait(150);
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
