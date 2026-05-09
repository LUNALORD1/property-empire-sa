// Fetches and caches public map-related API keys from the server.
// Keys are domain/referrer-restricted on the provider side, so it is
// acceptable to expose them to the browser at runtime.

let cache: { stadiaKey: string; streetViewKey: string } | null = null;
let inflight: Promise<{ stadiaKey: string; streetViewKey: string }> | null = null;

export function getMapConfig(): Promise<{ stadiaKey: string; streetViewKey: string }> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch("/api/public/config/maps")
    .then((r) => r.json())
    .then((data: { stadiaKey: string; streetViewKey: string }) => {
      cache = data;
      return data;
    })
    .catch(() => {
      const empty = { stadiaKey: "", streetViewKey: "" };
      cache = empty;
      return empty;
    });
  return inflight;
}

export function getCachedMapConfig() {
  return cache;
}

export function buildStreetViewUrl(address: string | null | undefined, locality: string | null | undefined, key: string): string | null {
  if (!key) return null;
  const parts = [address, locality, "South Africa"].filter(Boolean).join(", ");
  if (!parts.trim()) return null;
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(parts)}&key=${key}&return_error_codes=true`;
}
