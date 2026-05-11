import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/config/maps")({
  server: {
    handlers: {
      GET: async () => {
        const stadiaKey = process.env.STADIA_MAPS_API_KEY ?? "";
        return new Response(
          JSON.stringify({ stadiaKey }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
