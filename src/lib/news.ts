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
  event_type?: string;
  rate_delta?: number;
};

export type MarketNews = {
  id: string;
  tick_date: string;
  event_key: string;
  headline: string;
  city_id: string | null;
  price_modifier: number;
  event_type?: string;
  rate_delta?: number;
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
  weightFor?: (item: T) => number,
): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((s, e) => s + (weightFor ? weightFor(e) : e.weight), 0);
    let r = rand() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= weightFor ? weightFor(pool[j]) : pool[j].weight;
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
    .select("event_key, headline, city_id, price_modifier, weight, event_type, rate_delta");
  const all = ((catalog ?? []) as any[]) as NewsEvent[];
  if (!all.length) return [];

  const rand = mulberry32(hashSeed(date));
  // 2-3 events per day. Bias the pool ~60/40 toward positive price movements
  // so markets feel growth-oriented over time.
  const count = 2 + Math.floor(rand() * 2);
  const picks = pickWeighted(all, rand, count, (e) =>
    Number(e.price_modifier) > 0 ? e.weight * 1.5 : e.weight,
  );

  const rows = picks.map((p) => ({
    tick_date: date,
    event_key: p.event_key,
    headline: p.headline,
    city_id: p.city_id,
    price_modifier: p.price_modifier,
    event_type: p.event_type ?? "price",
    rate_delta: p.rate_delta ?? 0,
  }));
  // Ignore conflicts if another player just rolled the same day
  await (supabase as any).from("market_news").upsert(rows, { onConflict: "tick_date,event_key", ignoreDuplicates: true });
  const { data: re } = await supabase.from("market_news" as any).select("*").eq("tick_date", date);
  return ((re ?? []) as any) as MarketNews[];
}

/**
 * Effective interest-rate modifier for a given date — sum of rate_delta from
 * news_events that fired in the last 30 in-game days (1 real day = 1 month
 * in-game, but we use real calendar days for news so 30 days = 30 days).
 */
export async function getEffectiveRateModifier(date: string): Promise<number> {
  const since = new Date(date + "T00:00:00");
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data } = await (supabase as any)
    .from("market_news")
    .select("rate_delta, tick_date, event_key")
    .gte("tick_date", sinceStr)
    .lte("tick_date", date);
  // Deduplicate by event_key+tick_date in case of races
  const seen = new Set<string>();
  let total = 0;
  for (const r of (data ?? []) as any[]) {
    const k = `${r.tick_date}|${r.event_key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    total += Number(r.rate_delta ?? 0);
  }
  return total;
}

/** How many in-game months remain on the current rate modifier. */
export async function getRateModifierMonthsLeft(date: string): Promise<number> {
  const since = new Date(date + "T00:00:00");
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data } = await (supabase as any)
    .from("market_news")
    .select("tick_date, rate_delta")
    .gt("rate_delta", 0)
    .gte("tick_date", sinceStr)
    .lte("tick_date", date)
    .order("tick_date", { ascending: true });
  const oldest = (data ?? [])[0];
  if (!oldest) return 0;
  const oldestMs = new Date(oldest.tick_date + "T00:00:00").getTime();
  const todayMs = new Date(date + "T00:00:00").getTime();
  const daysElapsed = Math.floor((todayMs - oldestMs) / 86_400_000);
  return Math.max(0, 30 - daysElapsed);
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
    .select("id, name, momentum_score, modifier_updated_on, weather_multiplier, weather_label");
  const cities = (citiesRaw ?? []) as any[];
  if (!cities.length) return { events, modByCity: {} };

  const alreadyApplied = cities.every((c) => c.modifier_updated_on === date);
  const cityMods = computeCityModifiers(events, cities);
  const modByCity: Record<string, number> = {};
  for (const id of Object.keys(cityMods)) modByCity[id] = cityMods[id].mod;

  if (alreadyApplied) return { events, modByCity };

  // Insert one ticker headline per city experiencing notable bad weather
  // (weather_multiplier > 1.10). Idempotent via UNIQUE(tick_date, event_key).
  const weatherHeadlines: any[] = [];
  for (const c of cities) {
    const mult = Number(c.weather_multiplier ?? 1);
    if (mult > 1.1) {
      weatherHeadlines.push({
        tick_date: date,
        event_key: `weather_${c.id}_${date}`,
        headline: `${c.name}: ${c.weather_label ?? "Bad weather"} pushes maintenance ×${mult.toFixed(2)}`,
        city_id: c.id,
        price_modifier: 0,
        event_type: "weather",
        rate_delta: 0,
      });
    }
  }
  if (weatherHeadlines.length) {
    await (supabase as any)
      .from("market_news")
      .upsert(weatherHeadlines, { onConflict: "tick_date,event_key", ignoreDuplicates: true });
  }

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

    // Rental income tracks 50% of price movement (item #7).
    const rentMod = Math.round(entry.mod * 0.5 * 10000) / 10000;

    await supabase
      .from("cities")
      .update({
        daily_price_modifier: entry.mod,
        momentum_score: nextMomentum,
        modifier_updated_on: date,
        monthly_rent_modifier: rentMod,
      } as any)
      .eq("id", c.id);

    // Update market listings for this city (skip if 0 to avoid useless writes)
    if (entry.mod !== 0) {
      const { data: listings } = await supabase
        .from("properties")
        .select("id, listing_price")
          .eq("city_id", c.id)
          .eq("status", "active");
      for (const l of listings ?? []) {
        const nv = Math.max(50_000, Math.round(Number(l.listing_price) * (1 + entry.mod)));
        await supabase.from("properties").update({ listing_price: nv }).eq("id", l.id);
      }
    }
  }

  // ----- Daily market rotation: expire old listings, swap in fresh ones -----
  await rotateMarket(date);

  return { events, modByCity };
}

/**
 * Daily market rotation. Idempotent per real date via market_refresh_log PK.
 * - Expires any active listing whose expires_at has passed.
 * - Removes 5–10 random un-owned active listings (sold to outside buyers).
 * - Adds 5–10 fresh listings from reserve, distributed proportionally per city.
 * - Per-city scarcity check (<10 in reserve → only 1–2 added for that city
 *   and a "shortage" news headline gets logged in market_news).
 */
export async function rotateMarket(date: string) {
  // Idempotency: only one player should cause the rotation per day
  const { data: existing } = await (supabase as any)
    .from("market_refresh_log")
    .select("refresh_date")
    .eq("refresh_date", date)
    .maybeSingle();
  if (existing) return;

  let removed = 0, added = 0, expired = 0;

  // 1. Expire outdated listings → reserve
  const { data: expiredRows } = await supabase
    .from("properties")
    .select("id")
    .eq("status", "active")
    .lt("expires_at", date);
  if ((expiredRows ?? []).length) {
    await supabase
      .from("properties")
      .update({ status: "reserve", expires_at: null } as any)
      .in("id", (expiredRows as any[]).map((r) => r.id));
    expired = (expiredRows as any[]).length;
  }

  // 2. Remove 5–10 unowned active listings (outside buyers bought them)
  const { data: ownedRows } = await supabase
    .from("player_properties")
    .select("property_id");
  const ownedSet = new Set((ownedRows ?? []).map((r: any) => r.property_id));

  const { data: activeRows } = await supabase
    .from("properties")
    .select("id")
    .eq("status", "active");
  const removable = (activeRows ?? []).filter((r: any) => !ownedSet.has(r.id));
  const toRemove = Math.min(removable.length, 5 + Math.floor(Math.random() * 6));
  if (toRemove > 0) {
    const shuffled = removable.sort(() => Math.random() - 0.5).slice(0, toRemove);
    await supabase
      .from("properties")
      .update({ status: "reserve", expires_at: null } as any)
      .in("id", shuffled.map((r: any) => r.id));
    removed = toRemove;
  }

  // 3. Add 5–10 fresh listings from reserve, biased per city by reserve count
  const targetAdds = 5 + Math.floor(Math.random() * 6);
  // Group reserves by city
  const { data: reserveRows } = await supabase
    .from("properties")
    .select("id, city_id")
    .eq("status", "reserve");
  const reserveByCity: Record<string, string[]> = {};
  for (const r of reserveRows ?? []) {
    (reserveByCity[(r as any).city_id] ||= []).push((r as any).id);
  }
  const cityIds = Object.keys(reserveByCity);
  const newRows: string[] = [];
  const shortageHeadlines: any[] = [];

  // Get city names for headlines
  const { data: cityNames } = await supabase.from("cities").select("id, name");
  const cityName: Record<string, string> = {};
  for (const c of cityNames ?? []) cityName[c.id] = c.name;

  for (let i = 0; i < targetAdds && cityIds.length; i++) {
    const cid = cityIds[Math.floor(Math.random() * cityIds.length)];
    const pool = reserveByCity[cid];
    if (!pool || pool.length === 0) continue;
    const isShortage = pool.length < 10;
    if (isShortage && Math.random() < 0.5) continue; // throttle to 1-2 from short-reserve cities
    const idx = Math.floor(Math.random() * pool.length);
    const id = pool.splice(idx, 1)[0];
    newRows.push(id);
    if (isShortage && !shortageHeadlines.find((h) => h.city_id === cid)) {
      shortageHeadlines.push({
        tick_date: date,
        event_key: `shortage_${cid}_${date}`,
        headline: `Property shortage in ${cityName[cid] ?? "the market"} — limited listings available`,
        city_id: cid,
        price_modifier: 0,
        event_type: "shortage",
        rate_delta: 0,
      });
    }
  }
  if (newRows.length) {
    // assign each a fresh expires_at + listed_at
    for (const id of newRows) {
      const days = 7 + Math.floor(Math.random() * 15);
      const exp = new Date(date + "T00:00:00");
      exp.setDate(exp.getDate() + days);
      await supabase.from("properties").update({
        status: "active",
        listed_at: new Date().toISOString(),
        expires_at: exp.toISOString().slice(0, 10),
      } as any).eq("id", id);
    }
    added = newRows.length;

    // Per-city "new listings" headlines
    const byCity: Record<string, number> = {};
    const { data: addedCity } = await supabase
      .from("properties")
      .select("city_id")
      .in("id", newRows);
    for (const r of addedCity ?? []) byCity[(r as any).city_id] = (byCity[(r as any).city_id] ?? 0) + 1;
    const newHeadlines = Object.entries(byCity).map(([cid, n]) => ({
      tick_date: date,
      event_key: `new_listings_${cid}_${date}`,
      headline: `${n} new listing${n === 1 ? "" : "s"} hit the market in ${cityName[cid] ?? "the market"} today`,
      city_id: cid,
      price_modifier: 0,
      event_type: "new_listings",
      rate_delta: 0,
    }));
    if (newHeadlines.length || shortageHeadlines.length) {
      await (supabase as any)
        .from("market_news")
        .upsert([...newHeadlines, ...shortageHeadlines], { onConflict: "tick_date,event_key", ignoreDuplicates: true });
    }
  }

  await (supabase as any).from("market_refresh_log").insert({
    refresh_date: date,
    removed,
    added,
    expired,
  });
}