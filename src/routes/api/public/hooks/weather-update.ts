import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Daily cron: fetch current weather for every city and update its
 * `weather_multiplier` so the daily-tick maintenance cost reflects local
 * conditions.
 *
 * Multiplier mapping (rough but tuned for fun, not realism):
 *   storm / heavy rain            -> 1.30
 *   light rain / drizzle          -> 1.15
 *   snow / extreme heat (>=35C)   -> 1.20
 *   strong wind (>10 m/s)         -> 1.10
 *   normal                        -> 1.00
 */
function pickMultiplier(w: any): { mult: number; label: string } {
  const id: number = w?.weather?.[0]?.id ?? 800;
  const main: string = (w?.weather?.[0]?.main ?? "Clear").toLowerCase();
  const temp: number = w?.main?.temp ?? 20;
  const wind: number = w?.wind?.speed ?? 0;

  if (id >= 200 && id < 300) return { mult: 1.3, label: "Thunderstorm" };
  if (id >= 500 && id < 600) {
    if (id >= 502) return { mult: 1.3, label: "Heavy rain" };
    return { mult: 1.15, label: "Rain" };
  }
  if (id >= 300 && id < 400) return { mult: 1.15, label: "Drizzle" };
  if (id >= 600 && id < 700) return { mult: 1.2, label: "Snow" };
  if (temp >= 35) return { mult: 1.2, label: "Heatwave" };
  if (wind >= 10) return { mult: 1.1, label: "Windy" };
  if (main === "clouds") return { mult: 1.0, label: "Cloudy" };
  return { mult: 1.0, label: "Clear" };
}

export const Route = createFileRoute("/api/public/hooks/weather-update")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "OPENWEATHERMAP_API_KEY not configured" }, { status: 500 });
        }

        const { data: cities, error } = await supabaseAdmin
          .from("cities")
          .select("id, name, latitude, longitude");
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: Array<{ city: string; mult: number; label: string }> = [];
        for (const c of cities ?? []) {
          try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${c.latitude}&lon=${c.longitude}&units=metric&appid=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) {
              console.error(`OWM ${c.name} ${res.status}`);
              continue;
            }
            const w = await res.json();
            const { mult, label } = pickMultiplier(w);
            await supabaseAdmin
              .from("cities")
              .update({ weather_multiplier: mult, weather_label: label })
              .eq("id", c.id);
            results.push({ city: c.name, mult, label });
          } catch (e: any) {
            console.error(`OWM error ${c.name}`, e?.message);
          }
        }
        return Response.json({ ok: true, updated: results });
      },
    },
  },
});