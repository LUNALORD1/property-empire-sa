import { supabase } from "@/integrations/supabase/client";

export const PRIME_RATE = 11.75; // SA prime, %

export type City = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  annual_appreciation_pct: number;
  weather_multiplier: number;
  weather_label?: string;
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

export type Loan = {
  id: string;
  player_id: string;
  player_property_id: string;
  principal: number;
  balance: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  ltv: number;
  active: boolean;
  started_at: string;
};

export type Assistant = {
  id: string;
  player_id: string;
  monthly_cost: number;
  points_added: number;
  active: boolean;
  hired_at: string;
};

export type LuckEvent = {
  id: string;
  player_id: string;
  event_key: string;
  title: string;
  description: string | null;
  amount: number;
  payload: any;
  acknowledged: boolean;
  created_at: string;
};

/** Compute monthly rent: rent scales with how the listing compares to suburb avg price. */
export function computeMonthlyRent(p: Pick<Property, "listing_price" | "suburb_avg_price" | "suburb_avg_rent">) {
  if (!p.suburb_avg_price) return p.suburb_avg_rent;
  const factor = p.listing_price / p.suburb_avg_price;
  const adjusted = 0.4 + 0.6 * factor;
  return Math.round(p.suburb_avg_rent * adjusted);
}

/** Monthly maintenance: ~0.75% of value annually, divided by 12, then weather multiplier. */
export function computeMonthlyMaintenance(value: number, weatherMultiplier = 1.0) {
  return Math.round(((value * 0.0075) / 12) * weatherMultiplier);
}

/** Standard amortisation formula. */
export function computeMonthlyPayment(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principal / months);
  const m = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(m);
}

export function netWorth(cash: number, properties: PlayerProperty[], debt: number) {
  const portfolio = properties.reduce((s, p) => s + Number(p.current_value), 0);
  return cash + portfolio - debt;
}

export function bedroomsToAdminPoints(properties: PlayerProperty[]) {
  return properties.reduce((s, p) => s + (p.property?.bedrooms ?? 0), 0);
}

export function totalAdminCap(baseCap: number, assistants: Assistant[]) {
  return baseCap + (assistants ?? []).filter((a) => a.active).reduce((s, a) => s + a.points_added, 0);
}

// ---------- Luck Events ----------

const LUCK_POOL: Array<{
  key: string; title: string; description: string;
  weight: number; effect: { kind: "cash" | "value_pct" | "rent_boost"; min: number; max: number };
  good: boolean;
}> = [
  { key: "great_tenant", title: "Great tenant!", description: "A model tenant pays 2 months upfront.", weight: 12, good: true, effect: { kind: "cash", min: 8000, max: 22000 } },
  { key: "lottery_dividend", title: "Surprise dividend", description: "An old investment paid out.", weight: 6, good: true, effect: { kind: "cash", min: 4000, max: 15000 } },
  { key: "neighbourhood_boom", title: "Neighbourhood boom", description: "A new mall lifted suburb prices.", weight: 8, good: true, effect: { kind: "value_pct", min: 1, max: 3 } },
  { key: "rent_hike", title: "Rent hike approved", description: "CPI adjustment lifted your rents.", weight: 8, good: true, effect: { kind: "rent_boost", min: 1, max: 2 } },
  { key: "burst_pipe", title: "Burst pipe", description: "An emergency plumber was called.", weight: 12, good: false, effect: { kind: "cash", min: -8000, max: -2500 } },
  { key: "loadshedding", title: "Stage 6 load-shedding", description: "Tenants demanded a partial rebate.", weight: 10, good: false, effect: { kind: "cash", min: -6000, max: -1500 } },
  { key: "geyser", title: "Geyser failure", description: "A geyser had to be replaced.", weight: 8, good: false, effect: { kind: "cash", min: -12000, max: -5000 } },
  { key: "market_dip", title: "Market dip", description: "A rate-hike rumour cooled the market.", weight: 6, good: false, effect: { kind: "value_pct", min: -2, max: -0.5 } },
];

function pickLuck() {
  const total = LUCK_POOL.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of LUCK_POOL) { if ((r -= e.weight) <= 0) return e; }
  return LUCK_POOL[0];
}

async function maybeRollLuckEvent(userId: string, today: string, lastLuckDate: string | null, ownsProperty: boolean) {
  if (!ownsProperty) return; // no events until they own
  if (lastLuckDate) {
    const last = new Date(lastLuckDate + "T00:00:00").getTime();
    const now = new Date(today + "T00:00:00").getTime();
    if ((now - last) / 86400000 < 2) return;
  }
  // Don't stack: if there's an unacknowledged event pending, skip this roll.
  const { data: pending } = await supabase
    .from("luck_events")
    .select("event_key, acknowledged")
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastEvent = pending?.[0];
  if (lastEvent && !lastEvent.acknowledged) return;
  const lastKey = lastEvent?.event_key;
  // Don't repeat the same event back-to-back: re-roll up to 5 times.
  let def = pickLuck();
  for (let i = 0; i < 5 && def.key === lastKey; i++) def = pickLuck();
  const span = def.effect.max - def.effect.min;
  const raw = def.effect.min + Math.random() * span;
  const amount = def.effect.kind === "cash" ? Math.round(raw / 500) * 500 : Number(raw.toFixed(2));

  const payload: any = { kind: def.effect.kind, value: amount };

  if (def.effect.kind === "cash") {
    // Apply cash directly
    const { data: p } = await supabase.from("profiles").select("cash").eq("id", userId).single();
    const newCash = Number(p?.cash ?? 0) + amount;
    await supabase.from("profiles").update({ cash: newCash }).eq("id", userId);
    await supabase.from("ledger").insert({ player_id: userId, type: "luck", amount, description: def.title });
  } else if (def.effect.kind === "value_pct") {
    const { data: pps } = await supabase.from("player_properties").select("id, current_value").eq("player_id", userId);
    for (const pp of pps ?? []) {
      const nv = Math.round(Number(pp.current_value) * (1 + amount / 100));
      await supabase.from("player_properties").update({ current_value: nv }).eq("id", pp.id);
    }
  } else if (def.effect.kind === "rent_boost") {
    const { data: pps } = await supabase.from("player_properties").select("id, monthly_rent").eq("player_id", userId);
    for (const pp of pps ?? []) {
      const nr = Math.round(Number(pp.monthly_rent) * (1 + amount / 100));
      await supabase.from("player_properties").update({ monthly_rent: nr }).eq("id", pp.id);
    }
  }

  await supabase.from("luck_events").insert({
    player_id: userId,
    event_key: def.key,
    title: def.title,
    description: def.description,
    amount: def.effect.kind === "cash" ? amount : 0,
    payload,
  });
  await supabase.from("profiles").update({ last_luck_event_date: today }).eq("id", userId);
}

/**
 * Process all missed in-game days for the current player.
 * 1 real day = 1 in-game month.
 */
export async function processDailyTicks(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("cash, last_tick_date, game_started_at, last_luck_event_date")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: pps } = await supabase
    .from("player_properties")
    .select("id, current_value, monthly_rent, monthly_maintenance, status, property_id, properties:property_id(city_id, cities:city_id(weather_multiplier, annual_appreciation_pct))")
    .eq("player_id", userId);

  const { data: loans } = await supabase
    .from("loans")
    .select("id, balance, interest_rate, monthly_payment, term_months")
    .eq("player_id", userId)
    .eq("active", true);

  const { data: assistants } = await supabase
    .from("assistants")
    .select("monthly_cost")
    .eq("player_id", userId)
    .eq("active", true);
  const assistantCostMonthly = (assistants ?? []).reduce((s, a) => s + Number(a.monthly_cost), 0);

  const startStr = profile.last_tick_date ?? new Date(profile.game_started_at).toISOString().slice(0, 10);
  const days: string[] = [];
  const cur = new Date(startStr + "T00:00:00");
  cur.setDate(cur.getDate() + 1);
  while (cur.toISOString().slice(0, 10) <= todayStr) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
    if (days.length > 60) break;
  }
  if (days.length === 0) return null;

  let cash = Number(profile.cash);
  let lastSummary: any = null;
  let lastLuck = profile.last_luck_event_date;

  for (const d of days) {
    let rentTotal = 0, maintTotal = 0, loanTotal = 0;
    const ledgerRows: any[] = [];

    for (const pp of pps ?? []) {
      const weather = (pp as any).properties?.cities?.weather_multiplier ?? 1.0;
      const appreciation = (pp as any).properties?.cities?.annual_appreciation_pct ?? 5.0;
      const isRented = pp.status === "rented";
      const rent = isRented ? Number(pp.monthly_rent) : 0;
      const maint = computeMonthlyMaintenance(Number(pp.current_value), Number(weather));
      rentTotal += rent;
      maintTotal += maint;
      if (rent > 0) ledgerRows.push({ player_id: userId, type: "rent", amount: rent, property_id: pp.property_id, description: "Rent collected" });
      ledgerRows.push({ player_id: userId, type: "maintenance", amount: -maint, property_id: pp.property_id, description: "Monthly maintenance" });

      const monthlyAppreciationPct = Number(appreciation) / 100 / 12;
      const newValue = Math.round(Number(pp.current_value) * (1 + monthlyAppreciationPct));
      await supabase.from("player_properties").update({ current_value: newValue }).eq("id", pp.id);
      pp.current_value = newValue;
    }

    // Loan repayments
    for (const ln of loans ?? []) {
      const balance = Number(ln.balance);
      if (balance <= 0) continue;
      const monthlyRate = Number(ln.interest_rate) / 100 / 12;
      const interest = balance * monthlyRate;
      const payment = Math.min(Number(ln.monthly_payment), balance + interest);
      const principalPaid = payment - interest;
      const newBalance = Math.max(0, balance - principalPaid);
      loanTotal += payment;
      ledgerRows.push({ player_id: userId, type: "loan", amount: -payment, description: "Bond repayment" });
      const updates: any = { balance: newBalance };
      if (newBalance <= 0.5) updates.active = false;
      await supabase.from("loans").update(updates).eq("id", ln.id);
      ln.balance = newBalance;
    }

    // Assistants payroll
    if (assistantCostMonthly > 0) {
      ledgerRows.push({ player_id: userId, type: "payroll", amount: -assistantCostMonthly, description: "Assistant salary" });
    }

    const net = rentTotal - maintTotal - loanTotal - assistantCostMonthly;
    cash += net;

    const tickRow = {
      player_id: userId,
      tick_date: d,
      rent_collected: rentTotal,
      maintenance_paid: maintTotal,
      loan_paid: loanTotal,
      net_cashflow: net,
      summary: { rent: rentTotal, maintenance: maintTotal, loan: loanTotal, payroll: assistantCostMonthly, net },
    };

    const { error: tickErr } = await supabase.from("daily_ticks").insert(tickRow);
    if (tickErr) continue;
    if (ledgerRows.length) await supabase.from("ledger").insert(ledgerRows);
    lastSummary = tickRow;

    // Try to roll a luck event for this day
    await maybeRollLuckEvent(userId, d, lastLuck, (pps ?? []).length > 0);
    // Refresh lastLuck from db cheaply
    const { data: pp2 } = await supabase.from("profiles").select("last_luck_event_date, cash").eq("id", userId).single();
    if (pp2) { lastLuck = pp2.last_luck_event_date; cash = Number(pp2.cash); }
  }

  await supabase.from("profiles").update({ cash, last_tick_date: todayStr }).eq("id", userId);

  return lastSummary;
}
