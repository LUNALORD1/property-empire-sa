import { supabase } from "@/integrations/supabase/client";

/**
 * News & price-movement system.
 * - Rolls a deterministic set of headlines per in-game day so all players see the same news.
 * - Computes a per-city daily price modifier (events + momentum) capped to [-2%, +3%].
 * - Updates market listing prices once per day per city.
 */

export const DAILY_CAP_UP = 0.03;
export const DAILY_CAP_DOWN = -0.02;
export const MOMENTUM_BONUS = 0.002; // 0.2% per momentum point
export const MOMENTUM_MIN = -3;
export const MOMENTUM_MAX = 3;

export type NewsEvent = {
  event_key: string;
  headline: string;
  city_id: string | null;
  price_modifier: number;
  weight: number;
};

export type MarketNews = {
  id: string;
  tick_date: string;
  event_key: string;
  headline: string;
  city_id: string | null;
  price_modifier: number;
};

// Deterministic PRNG so every player rolls the same news for a given date
function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends { weight: number }>(
  items: T[],
  rand: () => number,
  n: number,
): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = rand() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

export function clampDailyModifier(v: number) {
  return Math.max(DAILY_CAP_DOWN, Math.min(DAILY_CAP_UP, v));
}

/**
 * Ensure today's news has been rolled. Idempotent across players via
 * deterministic selection + UNIQUE(tick_date, event_key).
 */
export async function ensureNewsForDate(date: string): Promise<MarketNews[]> {
  const { data: existing } = await supabase
    .from("market_news" as any)
    .select("*")
    .eq("tick_date", date);
  if ((existing ?? []).length) return (existing as any) as MarketNews[];

  const { data: catalog } = await supabase
    .from("news_events" as any)
    .select("event_key, headline, city_id, price_modifier, weight");
  const all = ((catalog ?? []) as any[]) as NewsEvent[];
  if (!all.length) return [];

  const rand = mulberry32(hashSeed(date));
  // 2-3 events per day
  const count = 2 + Math.floor(rand() * 2);
  const picks = pickWeighted(all, rand, count);

  const rows = picks.map((p) => ({
    tick_date: date,
    event_key: p.event_key,
    headline: p.headline,
    city_id: p.city_id,
    price_modifier: p.price_modifier,
  }));
  // Ignore conflicts if another player just rolled the same day
  await (supabase as any).from("market_news").upsert(rows, { onConflict: "tick_date,event_key", ignoreDuplicates: true });
  const { data: re } = await supabase.from("market_news" as any).select("*").eq("tick_date", date);
  return ((re ?? []) as any) as MarketNews[];
}

/**
 * Build per-city final modifier (event sum + momentum bonus, capped).
 * Returns map cityId → { mod, hadEvent }.
 */
export function computeCityModifiers(
  events: MarketNews[],
  cities: Array<{ id: string; momentum_score: number }>,
) {
  const byCity: Record<string, { mod: number; hadEvent: boolean }> = {};
  for (const c of cities) byCity[c.id] = { mod: 0, hadEvent: false };
  for (const ev of events) {
    if (ev.city_id) {
      if (byCity[ev.city_id]) {
        byCity[ev.city_id].mod += Number(ev.price_modifier);
        byCity[ev.city_id].hadEvent = true;
      }
    } else {
      // nationwide
      for (const id of Object.keys(byCity)) {
        byCity[id].mod += Number(ev.price_modifier);
        byCity[id].hadEvent = true;
      }
    }
  }
  // Add momentum and clamp
  for (const c of cities) {
    const entry = byCity[c.id];
    entry.mod = clampDailyModifier(entry.mod + c.momentum_score * MOMENTUM_BONUS);
  }
  return byCity;
}

/**
 * Apply today's market modifier to cities + listings. Idempotent per day:
 * if cities.modifier_updated_on === date already, this is a no-op.
 * Returns the per-city modifier map and the events that fired.
 */
export async function applyDailyMarket(date: string): Promise<{
  events: MarketNews[];
  modByCity: Record<string, number>;
}> {
  const events = await ensureNewsForDate(date);
  const { data: citiesRaw } = await supabase
    .from("cities")
    .select("id, momentum_score, modifier_updated_on");
  const cities = (citiesRaw ?? []) as any[];
  if (!cities.length) return { events, modByCity: {} };

  const alreadyApplied = cities.every((c) => c.modifier_updated_on === date);
  const cityMods = computeCityModifiers(events, cities);
  const modByCity: Record<string, number> = {};
  for (const id of Object.keys(cityMods)) modByCity[id] = cityMods[id].mod;

  if (alreadyApplied) return { events, modByCity };

  for (const c of cities) {
    if (c.modifier_updated_on === date) continue;
    const entry = cityMods[c.id];
    // Momentum update: shift toward sign of net events; decay toward 0 if none
    let nextMomentum = c.momentum_score as number;
    const rawCityEventSum = events
      .filter((ev) => ev.city_id === c.id || ev.city_id === null)
      .reduce((s, ev) => s + Number(ev.price_modifier), 0);
    if (entry.hadEvent && rawCityEventSum !== 0) {
      nextMomentum += rawCityEventSum > 0 ? 1 : -1;
    } else {
      nextMomentum += nextMomentum > 0 ? -1 : nextMomentum < 0 ? 1 : 0;
    }
    nextMomentum = Math.max(MOMENTUM_MIN, Math.min(MOMENTUM_MAX, nextMomentum));

    await supabase
      .from("cities")
      .update({
        daily_price_modifier: entry.mod,
        momentum_score: nextMomentum,
        modifier_updated_on: date,
      } as any)
      .eq("id", c.id);

    // Update market listings for this city (skip if 0 to avoid useless writes)
    if (entry.mod !== 0) {
      const { data: listings } = await supabase
        .from("properties")
        .select("id, listing_price")
        .eq("city_id", c.id);
      for (const l of listings ?? []) {
        const nv = Math.max(50_000, Math.round(Number(l.listing_price) * (1 + entry.mod)));
        await supabase.from("properties").update({ listing_price: nv }).eq("id", l.id);
      }
    }
  }

  return { events, modByCity };
}