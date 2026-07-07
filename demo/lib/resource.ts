// The example protected resource the emblem attests to (a hash envelope points
// at it). It is served as application/json; the structured data inside is
// GeoJSON marking a Vienna landmark as protected.

export const RESOURCE_PATH = "/landmarks/stephansdom.json";
export const RESOURCE_CONTENT_TYPE = "application/json";
/** The signed payload-location (COSE hash-envelope header 260). */
export const RESOURCE_LOCATION = `https://emblem.red${RESOURCE_PATH}`;

/**
 * Where to actually fetch the resource bytes. In production this is the signed
 * location; for local dev set EMBLEM_RESOURCE_BASE (e.g. http://localhost:3000)
 * so the same committed bytes are hashed/verified without depending on the
 * deployed site.
 */
export function resourceFetchUrl(): string {
  const base = typeof process !== "undefined" ? process.env.EMBLEM_RESOURCE_BASE : undefined;
  return base ? base.replace(/\/$/, "") + RESOURCE_PATH : RESOURCE_LOCATION;
}

/** Fetch the exact resource bytes to hash (issue) or re-hash (verify). */
export async function fetchResourceBytes(): Promise<Uint8Array> {
  const res = await fetch(resourceFetchUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`resource fetch failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Resolve where to fetch a signed location, honoring EMBLEM_RESOURCE_BASE in dev. */
export function resolveFetchUrl(location: string): string {
  const base = typeof process !== "undefined" ? process.env.EMBLEM_RESOURCE_BASE : undefined;
  if (!base) return location;
  try {
    return base.replace(/\/$/, "") + new URL(location).pathname;
  } catch {
    return location;
  }
}
