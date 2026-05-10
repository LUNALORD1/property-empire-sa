// Proxies Google Street View Static API requests so the API key stays on the server
// and CORS / referrer restrictions don't block browser <img> requests.

const KEY = Deno.env.get("GOOGLE_STREET_VIEW_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim();
  const size = url.searchParams.get("size") ?? "800x600";

  if (!address) {
    return new Response("Missing address", { status: 400, headers: CORS });
  }
  if (!KEY) {
    console.error("street-view-proxy: GOOGLE_STREET_VIEW_API_KEY not set");
    return new Response("Server not configured", { status: 500, headers: CORS });
  }

  const target =
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${encodeURIComponent(size)}` +
    `&location=${encodeURIComponent(address)}` +
    `&key=${KEY}` +
    `&return_error_codes=true`;

  try {
    const upstream = await fetch(target);
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

    if (!upstream.ok || !contentType.startsWith("image/")) {
      const body = await upstream.text();
      console.error("street-view-proxy upstream error", upstream.status, body.slice(0, 200));
      return new Response("Upstream error", {
        status: 502,
        headers: { ...CORS, "content-type": "text/plain" },
      });
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        ...CORS,
        "content-type": contentType,
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("street-view-proxy fetch failed", err);
    return new Response("Fetch failed", { status: 502, headers: CORS });
  }
});