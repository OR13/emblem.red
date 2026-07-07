import { cn } from "@/lib/utils";

/**
 * Brand mark: a solid red shield. Deliberately NOT any of the protected
 * emblems (Red Cross / Red Crescent / Red Crystal), nor the protected
 * Hague-Convention blue shield.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-primary", className)}
      fill="currentColor"
      role="img"
      aria-label="emblem.red"
    >
      <path d="M12 1.5 3.75 4.6 V11.3 c0 5.4 3.5 9.3 8.25 11.2 C16.75 20.6 20.25 16.7 20.25 11.3 V4.6 Z" />
    </svg>
  );
}
