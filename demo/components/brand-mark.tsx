import { cn } from "@/lib/utils";

/**
 * Abstract brand mark: a solid plate framing a smaller open square — the
 * "registration plate" motif used across the site. Deliberately NOT any of the
 * protected emblems (Red Cross / Red Crescent / Red Crystal), which may not be
 * used decoratively.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex items-center justify-center bg-primary text-primary-foreground", className)}
    >
      <svg viewBox="0 0 24 24" className="h-[45%] w-[45%]" fill="none" stroke="currentColor" strokeWidth={2.75}>
        <rect x="4.5" y="4.5" width="15" height="15" />
      </svg>
    </span>
  );
}
