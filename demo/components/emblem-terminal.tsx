"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import "@xterm/xterm/css/xterm.css";
import styles from "./emblem-terminal.module.css";

// Readable, theme-aware xterm palettes (adapted from the or13.io terminal).
const DARK_THEME = {
  background: "#1b1512",
  foreground: "#f5f3f1",
  cursor: "#f5f3f1",
  cursorAccent: "#1b1512",
  selectionBackground: "#3a332f",
  black: "#1b1512",
  red: "#fb7185",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#93a4b8",
  magenta: "#f472b6",
  cyan: "#d6d3d1",
  white: "#f5f3f1",
  brightBlack: "#8a807b",
  brightRed: "#fda4af",
  brightGreen: "#86efac",
  brightYellow: "#fcd34d",
  brightBlue: "#b6c2d2",
  brightMagenta: "#f9a8d4",
  brightCyan: "#e7e5e4",
  brightWhite: "#ffffff",
};

const LIGHT_THEME = {
  background: "#faf9f8",
  foreground: "#1c1917",
  cursor: "#1c1917",
  cursorAccent: "#faf9f8",
  selectionBackground: "#e7e5e4",
  black: "#1c1917",
  red: "#be123c",
  green: "#15803d",
  yellow: "#a16207",
  blue: "#57708c",
  magenta: "#a21caf",
  cyan: "#57534e",
  white: "#faf9f8",
  brightBlack: "#78716c",
  brightRed: "#e11d48",
  brightGreen: "#16a34a",
  brightYellow: "#ca8a04",
  brightBlue: "#64748b",
  brightMagenta: "#c026d3",
  brightCyan: "#44403c",
  brightWhite: "#000000",
};

// ANSI helpers
const G = (s: string) => `\x1b[32m${s}\x1b[0m`; // green
const R = (s: string) => `\x1b[31m${s}\x1b[0m`; // red
const D = (s: string) => `\x1b[90m${s}\x1b[0m`; // dim
const C = (s: string) => `\x1b[36m${s}\x1b[0m`; // cyan (command echo)
const BG = (s: string) => `\x1b[1;32m${s}\x1b[0m`; // bold green
const BR = (s: string) => `\x1b[1;31m${s}\x1b[0m`; // bold red

const PROMPT = "$ ";

/** A verification transcript: prompt commands and their annotated output. */
interface Step {
  cmd: string;
  out: string[];
}

const SESSION: Step[] = [
  {
    cmd: "emblem verify emblem.red",
    out: [
      D("  ↳ HTTPS record · DoH"),
      `  ${G("✓")} emblem in key65280 · 157 B`,
      `  ${G("✓")} signature valid · ES256`,
      `  ${G("✓")} sub = emblem.red`,
      `  ${G("✓")} within validity window`,
      `  ${BG("● PROTECTED")}`,
    ],
  },
  {
    cmd: "emblem verify example.com",
    out: [
      D("  ↳ HTTPS record · DoH"),
      `  ${R("✗")} no emblem in record`,
      `  ${BR("● NOT PROTECTED")}`,
    ],
  },
];

export function EmblemTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);
  const timeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const { resolvedTheme } = useTheme();

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeouts.current.delete(id);
      fn();
    }, ms);
    timeouts.current.add(id);
    return id;
  }, []);

  const run = useCallback(
    async (term: import("@xterm/xterm").Terminal) => {
      if (hasRun.current) return;
      hasRun.current = true;
      const wait = (ms: number) => new Promise<void>((r) => schedule(r, ms));
      const type = async (str: string) => {
        for (const ch of str) {
          term.write(C(ch));
          await wait(Math.floor(Math.random() * 22) + 14);
        }
      };

      term.write(D("# is this domain protected?") + "\r\n\r\n");
      await wait(400);
      for (const step of SESSION) {
        term.write(PROMPT);
        await type(step.cmd);
        term.write("\r\n");
        await wait(300);
        for (const line of step.out) {
          term.write(line + "\r\n");
          await wait(Math.floor(Math.random() * 120) + 120);
        }
        term.write("\r\n");
        await wait(500);
      }
      term.write(PROMPT);
    },
    [schedule]
  );

  const printInstant = useCallback((term: import("@xterm/xterm").Terminal) => {
    term.write(D("# is this domain protected?") + "\r\n\r\n");
    for (const step of SESSION) {
      term.write(PROMPT + C(step.cmd) + "\r\n");
      for (const line of step.out) term.write(line + "\r\n");
      term.write("\r\n");
    }
    term.write(PROMPT);
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = resolvedTheme === "dark" ? DARK_THEME : LIGHT_THEME;
  }, [resolvedTheme]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let term: import("@xterm/xterm").Terminal | null = null;
    let fitAddon: import("@xterm/addon-fit").FitAddon | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let handleResize: (() => void) | null = null;
    const scheduled = timeouts.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function init() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      // Bail if the effect was cleaned up during the async import (React
      // StrictMode double-invokes effects in dev; without this guard two
      // terminals get opened on the same node).
      if (disposed || !el) return;
      const isDark = document.documentElement.classList.contains("dark");
      term = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        disableStdin: true,
        scrollback: 0,
        fontSize: 12.5,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        theme: isDark ? DARK_THEME : LIGHT_THEME,
        convertEol: false,
      });
      termRef.current = term;
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(el);
      requestAnimationFrame(() => fitAddon?.fit());
      handleResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => fitAddon?.fit(), 150);
      };
      window.addEventListener("resize", handleResize);
      if (reducedMotion) printInstant(term);
      else run(term);
    }
    init();

    return () => {
      disposed = true;
      for (const id of scheduled) clearTimeout(id);
      scheduled.clear();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (handleResize) window.removeEventListener("resize", handleResize);
      termRef.current = null;
      term?.dispose();
    };
  }, [run, printInstant]);

  return (
    <div
      ref={containerRef}
      className={styles.terminal}
      aria-label="Terminal demonstrating verification of whether a domain is protected"
    />
  );
}
