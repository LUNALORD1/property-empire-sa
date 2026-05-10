// Fetches and caches public map-related API keys from the server.
// Stadia tile key is referrer-restricted so it's safe in the browser.
// Street View images are fetched via a server-side proxy edge function so the
// Google key never touches the browser.

import { supabase } from "@/integrations/supabase/client";

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

export function buildStreetViewUrl(
  address: string | null | undefined,
  locality: string | null | undefined,
  _key?: string,
): string | null {
  const parts = [address, locality, "South Africa"].filter(Boolean).join(", ");
  if (!parts.trim()) return null;
  // Route via Supabase Edge Function proxy. The proxy injects the API key
  // server-side and returns the image with permissive CORS headers.
  const base = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
    || (import.meta as any).env?.VITE_SUPABASE_URL
    || "";
  const url = `${base}/functions/v1/street-view-proxy?address=${encodeURIComponent(parts)}&size=800x600`;
  return url;
}
