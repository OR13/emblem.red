import type { Landmark } from "@/lib/verify-service";

/** Visualizes the marked resource: a landmark, its coordinates, and its protected status. */
export function ResourceCard({
  landmark,
  location,
  contentType = "application/json",
}: {
  landmark: Landmark;
  location?: string;
  contentType?: string;
}) {
  const { name, localName, city, country, coords } = landmark;
  const isProtected = Boolean(landmark.protected);
  const coordStr = coords ? `${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E` : undefined;

  return (
    <figure className="overflow-hidden border border-border bg-card">
      <div
        className="relative flex h-44 items-center justify-center"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {isProtected && (
          <span className="absolute right-3 top-3 border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-primary uppercase">
            Protected
          </span>
        )}
        {/* marker */}
        <div className="relative">
          <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15" />
          <svg viewBox="0 0 24 24" className="relative h-10 w-10 text-primary drop-shadow-sm" fill="currentColor" aria-hidden>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.6" fill="var(--card)" />
          </svg>
        </div>
        {coordStr && (
          <span className="absolute bottom-3 left-3 font-mono text-[11px] text-muted-foreground">{coordStr}</span>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-4 border-t border-border p-4">
        <div className="min-w-0">
          <div className="truncate font-heading font-bold">{name ?? "Protected resource"}</div>
          <div className="truncate text-sm text-muted-foreground">
            {[localName, [city, country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            {name && " · "}
            <span className="font-mono">{contentType}</span>
          </div>
        </div>
        {location && (
          <a href={location} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-primary underline underline-offset-4">
            Resource →
          </a>
        )}
      </figcaption>
    </figure>
  );
}
