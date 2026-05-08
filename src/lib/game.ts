import { supabase } from "@/integrations/supabase/client";

export type City = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  annual_appreciation_pct: number;
  weather_multiplier: number;
};

export type Property = {
  id: string;
  city_id: string;
  suburb: string;
  address: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  listing_price: number;
  photo_url: string | null;
  suburb_avg_price: number;
  suburb_avg_rent: number;
  status: string;
};

export type PlayerProperty = {
  id: string;
  player_id: string;
  property_id: string;
  purchase_price: number;
  current_value: number;
  monthly_rent: number;
  monthly_maintenance: number;
  status: string;
  purchased_at: string;
  property?: Property & { city?: City };
};

/** Compute monthly rent: rent scales with how the listing compares to suburb avg price. */
export function computeMonthlyRent(p: Pick<Property, "listing_price" | "suburb_avg_price" | "suburb_avg_rent">) {
  if (!p.suburb_avg_price) return p.suburb_avg_rent;
  const factor = p.listing_price / p.suburb_avg_price;
  // Soften factor a bit so a 2x-priced house doesn't get 2x rent
  const adjusted = 0.4 + 0.6 * factor;
  return Math.round(p.suburb_avg_rent * adjusted);
}

/** Monthly maintenance: ~0.75% of value annually, divided by 12, then weather multiplier. */
export function computeMonthlyMaintenance(value: number, weatherMultiplier = 1.0) {
  return Math.round(((value * 0.0075) / 12) * weatherMultiplier);
}

/** Net worth = cash + sum(current_value) − sum(loan balances). */
export function netWorth(cash: number, properties: PlayerProperty[], debt: number) {
  const portfolio = properties.reduce((s, p) => s + Number(p.current_value), 0);
  return cash + portfolio - debt;
}

export function bedroomsToAdminPoints(properties: PlayerProperty[]) {
  return properties.reduce((s, p) => s + (p.property?.bedrooms ?? 0), 0);
}

/**
 * Process all missed in-game days for the current player.
 * 1 real day = 1 in-game month.
 * Returns a per-day summary for the most recent processed day (for the modal).
 */
export async function processDailyTicks(userId: string) {
  // Profile + last tick
  const { data: profile } = await supabase
    .from("profiles")
    .select("cash, last_tick_date, game_started_at")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Fetch player properties + city for weather multiplier + appreciation
  const { data: pps } = await supabase
    .from("player_properties")
    .select("id, current_value, monthly_rent, monthly_maintenance, status, property_id, properties:property_id(city_id, cities:city_id(weather_multiplier, annual_appreciation_pct))")
    .eq("player_id", userId);

  const startStr = profile.last_tick_date ?? new Date(profile.game_started_at).toISOString().slice(0, 10);
  const days: string[] = [];
  const cur = new Date(startStr + "T00:00:00");
  cur.setDate(cur.getDate() + 1);
  while (cur.toISOString().slice(0, 10) <= todayStr) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
    if (days.length > 60) break; // safety
  }
  if (days.length === 0) return null;

  let cash = Number(profile.cash);
  let lastSummary: any = null;

  for (const d of days) {
    let rentTotal = 0;
    let maintTotal = 0;
    const ledgerRows: any[] = [];

    for (const pp of pps ?? []) {
      const weather = (pp as any).properties?.cities?.weather_multiplier ?? 1.0;
      const appreciation = (pp as any).properties?.cities?.annual_appreciation_pct ?? 5.0;
      const isRented = pp.status === "rented";
      const rent = isRented ? Number(pp.monthly_rent) : 0;
      const maint = computeMonthlyMaintenance(Number(pp.current_value), Number(weather));

      rentTotal += rent;
      maintTotal += maint;

      if (rent > 0) {
        ledgerRows.push({
          player_id: userId,
          type: "rent",
          amount: rent,
          property_id: pp.property_id,
          description: `Rent collected`,
        });
      }
      ledgerRows.push({
        player_id: userId,
        type: "maintenance",
        amount: -maint,
        property_id: pp.property_id,
        description: `Monthly maintenance`,
      });

      // Monthly appreciation
      const monthlyAppreciationPct = Number(appreciation) / 100 / 12;
      const newValue = Math.round(Number(pp.current_value) * (1 + monthlyAppreciationPct));
      await supabase
        .from("player_properties")
        .update({ current_value: newValue })
        .eq("id", pp.id);
      pp.current_value = newValue;
    }

    const net = rentTotal - maintTotal;
    cash += net;

    const tickRow = {
      player_id: userId,
      tick_date: d,
      rent_collected: rentTotal,
      maintenance_paid: maintTotal,
      loan_paid: 0,
      net_cashflow: net,
      summary: { rent: rentTotal, maintenance: maintTotal, net },
    };

    // Idempotent insert (unique on player_id + tick_date)
    const { error: tickErr } = await supabase.from("daily_ticks").insert(tickRow);
    if (tickErr) {
      // Already processed this day, skip cash & ledger updates for it
      continue;
    }
    if (ledgerRows.length) {
      await supabase.from("ledger").insert(ledgerRows);
    }
    lastSummary = tickRow;
  }

  await supabase
    .from("profiles")
    .update({ cash, last_tick_date: todayStr })
    .eq("id", userId);

  return lastSummary;
}