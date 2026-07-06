// Read and parse a JSON request body, returning {} on empty/invalid input
// so route handlers can validate fields explicitly rather than 500.
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
