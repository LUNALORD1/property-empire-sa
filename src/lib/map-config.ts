// Fetches and caches the Stadia Maps tile API key from the server.
// The Stadia key is referrer-restricted so it is safe to expose in the browser.

let cache: { stadiaKey: string } | null = null;
let inflight: Promise<{ stadiaKey: string }> | null = null;

export function getMapConfig(): Promise<{ stadiaKey: string }> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch("/api/public/config/maps")
    .then((r) => r.json())
    .then((data: { stadiaKey: string }) => {
      cache = { stadiaKey: data.stadiaKey ?? "" };
      return cache;
    })
    .catch(() => {
      const empty = { stadiaKey: "" };
      cache = empty;
      return empty;
    });
  return inflight;
}

export function getCachedMapConfig() {
  return cache;
}
