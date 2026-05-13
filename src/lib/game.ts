import { supabase } from "@/integrations/supabase/client";
import { checkAchievements } from "@/lib/achievements";
import {
  finaliseSale,
  generateApplicants,
  topUpApplicants,
  DAMAGE_RISK_PCT,
  DEMAND_COUNT,
  type RenterType,
} from "@/lib/tenants";
import { applyDailyMarket, getEffectiveRateModifier } from "@/lib/news";

export const PRIME_RATE = 11.75; // SA prime, %

/** LTV → annual % rate (origination, before preferred-client discount). */
export function ltvBaseRate(ltv: number): number {
  if (ltv <= 50) return PRIME_RATE - 0.25;
  if (ltv <= 70) return PRIME_RATE;
  if (ltv <= 85) return PRIME_RATE + 0.5;
  return PRIME_RATE + 1.0;
}

/** Preferred-client discount in % based on properties owned. */
export function preferredDiscount(propertyCount: number): number {
  if (propertyCount >= 10) return 0.5;
  if (propertyCount >= 5) return 0.25;
  return 0;
}

export function preferredTier(propertyCount: number): "premium" | "preferred" | null {
  if (propertyCount >= 10) return "premium";
  if (propertyCount >= 5) return "preferred";
  return null;
}

/** Final origination rate given LTV and player property count. */
export function originationRate(ltv: number, propertyCount: number): number {
  return Math.max(1, ltvBaseRate(ltv) - preferredDiscount(propertyCount));
}

// ---------- Property tiers ----------
export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIERS: Array<{ id: Tier; label: string; short: string; min: number; max: number; color: string }> = [
  { id: 1, label: "Entry",    short: "Entry",    min: 0,            max: 500_000,    color: "bg-slate-500/20 text-slate-200 border-slate-400/40" },
  { id: 2, label: "Mid Entry",short: "Mid",      min: 500_000,      max: 1_500_000,  color: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
  { id: 3, label: "Mid Range",short: "Mid+",     min: 1_500_000,    max: 4_000_000,  color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" },
  { id: 4, label: "Prestige", short: "Prestige", min: 4_000_000,    max: 12_000_000, color: "bg-violet-500/20 text-violet-200 border-violet-400/40" },
  { id: 5, label: "Trophy",   short: "Trophy",   min: 12_000_000,   max: Infinity,   color: "bg-amber-500/25 text-amber-200 border-amber-400/50" },
];
export function tierForPrice(price: number): typeof TIERS[number] {
  return TIERS.find((t) => price >= t.min && price < t.max) ?? TIERS[TIERS.length - 1];
}

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
  // Positive personal events (~60% weight)
  { key: "work_bonus",       title: "Unexpected work bonus",      description: "Your boss surprised you with a once-off bonus.", weight: 9, good: true, effect: { kind: "cash", min: 8000, max: 8000 } },
  { key: "inheritance",      title: "Small inheritance",          description: "A relative gifted you some money.",              weight: 5, good: true, effect: { kind: "cash", min: 15000, max: 15000 } },
  { key: "radio_comp",       title: "Radio competition winner",   description: "You won a local radio competition.",             weight: 6, good: true, effect: { kind: "cash", min: 3000, max: 3000 } },
  { key: "side_hustle",      title: "Side hustle paid off",       description: "Your side hustle had a great month.",            weight: 7, good: true, effect: { kind: "cash", min: 5000, max: 5000 } },
  { key: "rates_refund",     title: "Rates bill refund",          description: "You found an error in your favour on your rates bill.", weight: 6, good: true, effect: { kind: "cash", min: 2000, max: 2000 } },
  { key: "friend_repaid",    title: "Friend repaid an old debt",  description: "A friend you'd written off finally paid you back.", weight: 6, good: true, effect: { kind: "cash", min: 6000, max: 6000 } },
  { key: "tax_refund",       title: "SARS tax refund",            description: "SARS surprised you with a refund.",              weight: 6, good: true, effect: { kind: "cash", min: 4500, max: 4500 } },
  { key: "sold_furniture",   title: "Sold old furniture",         description: "You cleared out the garage and made some cash.", weight: 5, good: true, effect: { kind: "cash", min: 1800, max: 1800 } },
  { key: "small_dividend",   title: "Investment dividend",        description: "Your investment account paid a small dividend.", weight: 5, good: true, effect: { kind: "cash", min: 3200, max: 3200 } },
  { key: "salary_bump",      title: "Salary increase bonus",      description: "You got a salary increase — once-off bonus.",    weight: 5, good: true, effect: { kind: "cash", min: 7000, max: 7000 } },
  // Negative personal events (~40% weight)
  { key: "slip_injury",      title: "Slipped and needed care",    description: "An unfortunate slip needed medical attention.",  weight: 5, good: false, effect: { kind: "cash", min: -4000, max: -4000 } },
  { key: "car_repairs",      title: "Car repairs",                description: "Your car needed unexpected repairs.",            weight: 6, good: false, effect: { kind: "cash", min: -5000, max: -5000 } },
  { key: "family_travel",    title: "Family emergency travel",    description: "A family emergency required urgent travel.",     weight: 4, good: false, effect: { kind: "cash", min: -7000, max: -7000 } },
  { key: "burst_geyser",     title: "Burst geyser at home",       description: "Your primary residence's geyser packed up.",     weight: 5, good: false, effect: { kind: "cash", min: -3500, max: -3500 } },
  { key: "traffic_fine",     title: "Traffic fine",               description: "A traffic fine arrived in the post.",            weight: 5, good: false, effect: { kind: "cash", min: -1500, max: -1500 } },
  { key: "laptop_died",      title: "Laptop died",                description: "Your laptop died and needed replacing.",          weight: 4, good: false, effect: { kind: "cash", min: -6000, max: -6000 } },
  { key: "family_help",      title: "Helped a family member",     description: "A family member needed financial help.",         weight: 5, good: false, effect: { kind: "cash", min: -4000, max: -4000 } },
  { key: "dental_bill",      title: "Unexpected dental bill",     description: "An unexpected dental bill landed.",              weight: 4, good: false, effect: { kind: "cash", min: -2500, max: -2500 } },
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
    await supabase.from("ledger").insert({
      player_id: userId, type: "luck", amount: 0,
      description: `${def.title} (property values ${amount >= 0 ? "+" : ""}${amount}%)`,
    });
  } else if (def.effect.kind === "rent_boost") {
    const { data: pps } = await supabase.from("player_properties").select("id, monthly_rent").eq("player_id", userId);
    for (const pp of pps ?? []) {
      const nr = Math.round(Number(pp.monthly_rent) * (1 + amount / 100));
      await supabase.from("player_properties").update({ monthly_rent: nr }).eq("id", pp.id);
    }
    await supabase.from("ledger").insert({
      player_id: userId, type: "luck", amount: 0,
      description: `${def.title} (rents +${amount}%)`,
    });
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
    .select("cash, last_tick_date, game_started_at, last_luck_event_date, peak_net_worth, red_zone_started_at, game_over")
    .eq("id", userId)
    .single();
  if (!profile) return null;
  if ((profile as any).game_over) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: pps } = await supabase
    .from("player_properties")
    .select(
      "id, current_value, monthly_rent, monthly_maintenance, status, property_id, condition_score, evicting_until, selling_notice_until, " +
      "properties:property_id(city_id, bedrooms, demand_tier, cities:city_id(weather_multiplier, annual_appreciation_pct))"
    )
    .eq("player_id", userId);

  // Active tenants & renter types
  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("*, renter_type:renter_type_key(*)")
    .eq("player_id", userId);
  const tenantByPP = new Map<string, any>();
  (tenants ?? []).forEach((t: any) => tenantByPP.set(t.player_property_id, t));

  const { data: loans } = await supabase
    .from("loans")
    .select("id, balance, interest_rate, monthly_payment, term_months, principal, player_property_id, insurance_active, insurance_premium_pct, holiday_active, last_partial_repayment_month, overpayment_streak, rate_reduction_applied")
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
  let peakNW = Number((profile as any).peak_net_worth ?? 0);
  let redZoneStart: string | null = (profile as any).red_zone_started_at;
  let gameOver = false;

  for (const d of days) {
    let rentTotal = 0, maintTotal = 0, loanTotal = 0;
    const ledgerRows: any[] = [];

    // ----- Daily market: roll news, update city modifier + listings -----
    const { modByCity } = await applyDailyMarket(d);

    // Pull per-city monthly rent modifier set by today's market events (item #7)
    const { data: cityRentRows } = await supabase
      .from("cities")
      .select("id, monthly_rent_modifier");
    const rentModByCity: Record<string, number> = {};
    for (const cr of (cityRentRows ?? []) as any[]) {
      rentModByCity[cr.id] = Number(cr.monthly_rent_modifier ?? 0);
    }
    const historyRows: any[] = [];

    for (const pp of (pps as any[]) ?? []) {
      const weather = (pp as any).properties?.cities?.weather_multiplier ?? 1.0;
      const appreciation = (pp as any).properties?.cities?.annual_appreciation_pct ?? 5.0;
      const propertyId = pp.property_id;
      const tenant = tenantByPP.get(pp.id);
      const ppUpdates: any = {};

      // ----- Sale finalisation (1-month notice) -----
      if (pp.status === "selling" && pp.selling_notice_until && pp.selling_notice_until <= d) {
        const value = Number(pp.current_value);
        const commission = Math.round(value * 0.05);
        const { data: lns } = await supabase.from("loans").select("balance").eq("player_property_id", pp.id).eq("active", true);
        const bond = (lns ?? []).reduce((s, l) => s + Number(l.balance), 0);
        const net = value - commission - bond;
        await finaliseSale({ userId, playerPropertyId: pp.id, value, commission, bond, net });
        cash += net; // sale proceeds in this tick
        continue;
      }

      // ----- Eviction in progress -----
      if (pp.status === "evicting" && pp.evicting_until) {
        const maint = computeMonthlyMaintenance(Number(pp.current_value), Number(weather));
        maintTotal += maint;
        ledgerRows.push({ player_id: userId, type: "maintenance", amount: -maint, property_id: propertyId, description: "Monthly maintenance" });
        if (pp.evicting_until <= d) {
          ppUpdates.status = "vacant";
          ppUpdates.evicting_until = null;
          ppUpdates.vacancy_started_at = d;
          await (supabase as any).from("tenants").delete().eq("player_property_id", pp.id);
          tenantByPP.delete(pp.id);
          ledgerRows.push({ player_id: userId, type: "eviction", amount: 0, property_id: propertyId, description: "Eviction completed — property vacant" });
          await generateApplicants({ userId, playerPropertyId: pp.id, property: (pp as any).properties as any });
        }
      } else if (pp.status === "rented" && tenant) {
        // ----- Rent collection w/ reliability -----
        const rt: RenterType = tenant.renter_type;
        const reliable = Math.random() * 100 < Number(rt.reliability);
        let rent = 0;
        if (reliable) {
          const cityId = (pp as any).properties?.city_id;
          const rMod = cityId ? (rentModByCity[cityId] ?? 0) : 0;
          rent = Math.max(0, Math.round(Number(tenant.monthly_rent) * (1 + rMod)));
          rentTotal += rent;
          ledgerRows.push({ player_id: userId, type: "rent", amount: rent, property_id: propertyId, description: `Rent — ${rt.display_name}` });
          tenant.consecutive_missed_payments = 0;
        } else {
          tenant.consecutive_missed_payments = Number(tenant.consecutive_missed_payments) + 1;
          tenant.happiness = Math.max(0, Number(tenant.happiness) - 5);
          ledgerRows.push({ player_id: userId, type: "late_payment", amount: 0, property_id: propertyId, description: `Late payment — ${rt.display_name}` });

          if (tenant.consecutive_missed_payments >= 2) {
            // Start eviction (2 months)
            const ev = new Date(d + "T00:00:00");
            ev.setDate(ev.getDate() + 2);
            ppUpdates.status = "evicting";
            ppUpdates.evicting_until = ev.toISOString().slice(0, 10);
            await (supabase as any).from("tenants").update({ status: "evicting" }).eq("id", tenant.id);
            ledgerRows.push({ player_id: userId, type: "eviction_notice", amount: 0, property_id: propertyId, description: `Eviction notice issued — ${rt.display_name}` });
          }
        }

        // ----- Damage roll -----
        const dmgPct = DAMAGE_RISK_PCT[rt.damage_risk] ?? 5;
        if (Math.random() * 100 < dmgPct) {
          const cost = Math.round(Math.max(2000, Math.min(15000, Number(pp.current_value) * 0.0008)) * (0.6 + Math.random()));
          maintTotal += cost;
          ledgerRows.push({ player_id: userId, type: "repair", amount: -cost, property_id: propertyId, description: `Repair — ${rt.display_name}` });
          ppUpdates.condition_score = Math.max(0, Number(pp.condition_score ?? 100) - 5);
          tenant.unaddressed = (tenant.unaddressed ?? 0) + 1;
        }

        // ----- Happiness drift -----
        if (Number(pp.condition_score ?? 100) < 70) tenant.happiness = Math.max(0, Number(tenant.happiness) - 5);
        if ((tenant.unaddressed ?? 0) >= 2) tenant.happiness = Math.max(0, Number(tenant.happiness) - 10);

        // ----- Lease expiry -----
        if (tenant.lease_end <= d && (ppUpdates.status ?? pp.status) === "rented") {
          // Auto-renew at 5% discount
          const newRent = Math.round(Number(tenant.monthly_rent) * 0.95);
          tenant.monthly_rent = newRent;
          const newEnd = new Date(d + "T00:00:00");
          newEnd.setDate(newEnd.getDate() + Number(rt.lease_months ?? 12));
          tenant.lease_start = d;
          tenant.lease_end = newEnd.toISOString().slice(0, 10);
          ppUpdates.monthly_rent = newRent;
          ledgerRows.push({ player_id: userId, type: "lease_renewed", amount: 0, property_id: propertyId, description: `Lease auto-renewed at -5% (${rt.display_name})` });
        }

        // ----- Tenant leaves on happiness 0 or status 'leaving' -----
        if (tenant.happiness <= 0 || tenant.status === "leaving") {
          await (supabase as any).from("tenants").delete().eq("id", tenant.id);
          tenantByPP.delete(pp.id);
          ppUpdates.status = "vacant";
          ppUpdates.vacancy_started_at = d;
          ledgerRows.push({ player_id: userId, type: "tenant_left", amount: 0, property_id: propertyId, description: `Tenant moved out — ${rt.display_name}` });
          await generateApplicants({ userId, playerPropertyId: pp.id, property: (pp as any).properties as any });
        } else {
          await (supabase as any)
            .from("tenants")
            .update({
              monthly_rent: tenant.monthly_rent,
              happiness: tenant.happiness,
              consecutive_missed_payments: tenant.consecutive_missed_payments,
              lease_start: tenant.lease_start,
              lease_end: tenant.lease_end,
            })
            .eq("id", tenant.id);
        }

        // ----- Maintenance always -----
        const maint = computeMonthlyMaintenance(Number(pp.current_value), Number(weather));
        maintTotal += maint;
        ledgerRows.push({ player_id: userId, type: "maintenance", amount: -maint, property_id: propertyId, description: "Monthly maintenance" });
      } else {
        // Vacant — costs continue, no rent
        const maint = computeMonthlyMaintenance(Number(pp.current_value), Number(weather));
        maintTotal += maint;
        ledgerRows.push({ player_id: userId, type: "maintenance", amount: -maint, property_id: propertyId, description: "Monthly maintenance (vacant)" });

        // ----- Daily applicant top-up -----
        // Vacancy length grows the pool: 1 month = 1 applicant, 2 = 2, 3+ = 3,
        // capped at the demand-tier maximum. Only top up if the pool is below
        // its target.
        const property = (pp as any).properties as any;
        if (property) {
          const startedStr = (pp as any).vacancy_started_at ?? d;
          const startedMs = new Date(startedStr + "T00:00:00").getTime();
          const todayMs = new Date(d + "T00:00:00").getTime();
          const monthsVacant = Math.max(0, Math.floor((todayMs - startedMs) / 86_400_000));
          const tierMax = DEMAND_COUNT[property.demand_tier ?? "medium"] ?? 2;
          const desired = Math.min(tierMax, Math.max(1, monthsVacant + 1));
          const { data: cur } = await (supabase as any)
            .from("tenant_applicants")
            .select("id")
            .eq("player_property_id", pp.id);
          const haveCount = (cur ?? []).length;
          if (haveCount === 0) {
            await generateApplicants({
              userId,
              playerPropertyId: pp.id,
              property,
              count: desired,
            });
          } else if (haveCount < desired) {
            await topUpApplicants({ userId, playerPropertyId: pp.id, property });
          }
        }
      }

      // ----- Appreciation: baseline monthly + today's city market modifier -----
      const monthlyAppreciationPct = Number(appreciation) / 100 / 12;
      const cityId = (pp as any).properties?.city_id;
      const dailyMarketMod = cityId ? (modByCity[cityId] ?? 0) : 0;
      const newValue = Math.max(
        50_000,
        Math.round(Number(pp.current_value) * (1 + monthlyAppreciationPct) * (1 + dailyMarketMod)),
      );
      ppUpdates.current_value = newValue;
      pp.current_value = newValue;
      historyRows.push({
        player_property_id: pp.id,
        player_id: userId,
        recorded_date: d,
        value: newValue,
      });

      if (Object.keys(ppUpdates).length) {
        await supabase.from("player_properties").update(ppUpdates).eq("id", pp.id);
        if (ppUpdates.status) pp.status = ppUpdates.status;
      }
    }

    // ----- Persist value history (upsert; keep last 7 days only) -----
    if (historyRows.length) {
      await (supabase as any)
        .from("property_value_history")
        .upsert(historyRows, { onConflict: "player_property_id,recorded_date" });
      const cutoff = new Date(d + "T00:00:00");
      cutoff.setDate(cutoff.getDate() - 7);
      await (supabase as any)
        .from("property_value_history")
        .delete()
        .eq("player_id", userId)
        .lt("recorded_date", cutoff.toISOString().slice(0, 10));
    }

    // ----- Demand drift (per property) -----
    if ((pps ?? []).length) {
      const month = Number(d.slice(5, 7));
      const tiers = ["low", "medium", "high", "hot"];
      const drifts: { id: string; tier: string }[] = [];
      const propIds = ((pps as any[]) ?? []).map((p: any) => p.property_id);
      const { data: marketProps } = await supabase
        .from("properties")
        .select("id, demand_tier, is_university_suburb, is_coastal")
        .in("id", propIds as any);
      for (const mp of (marketProps as any[]) ?? []) {
        let tier = (mp as any).demand_tier ?? "medium";
        // Seasonal overrides
        if ((mp as any).is_university_suburb && (month === 1 || month === 2)) tier = "hot";
        else if ((mp as any).is_coastal && (month === 11 || month === 12)) tier = "hot";
        else if (Math.random() < 0.2) {
          const idx = tiers.indexOf(tier);
          const dir = Math.random() < 0.5 ? -1 : 1;
          const next = Math.max(0, Math.min(tiers.length - 1, idx + dir));
          tier = tiers[next];
        }
        if (tier !== (mp as any).demand_tier) drifts.push({ id: (mp as any).id, tier });
      }
      for (const drift of drifts) {
        await supabase.from("properties").update({ demand_tier: drift.tier } as any).eq("id", drift.id);
      }
    }

    // Loan repayments — applies SARB rate modifier, payment holidays, insurance,
    // overpayment streak loyalty bonuses.
    const rateModifier = await getEffectiveRateModifier(d);
    const monthYYYYMM = d.slice(0, 7);
    const prevMonthYYYYMM = (() => {
      const dt = new Date(d + "T00:00:00");
      dt.setMonth(dt.getMonth() - 1);
      return dt.toISOString().slice(0, 7);
    })();
    for (const ln of (loans ?? []) as any[]) {
      const balance = Number(ln.balance);
      if (balance <= 0) continue;
      const monthlyRate = (Number(ln.interest_rate) + rateModifier) / 100 / 12;
      const interest = balance * monthlyRate;
      const propIdForLoan = (pps as any[] ?? []).find((p: any) => p.id === ln.player_property_id)?.property_id;

      // Insurance premium charged monthly regardless
      let premiumCost = 0;
      if (ln.insurance_active) {
        premiumCost = Math.round(Number(ln.principal) * 0.002);
        loanTotal += premiumCost;
        ledgerRows.push({ player_id: userId, type: "insurance", amount: -premiumCost, property_id: propIdForLoan, description: "Loan insurance premium" });
      }

      // Streak bookkeeping
      let newStreak = Number(ln.overpayment_streak ?? 0);
      let reductionApplied = Number(ln.rate_reduction_applied ?? 0);
      let newRate = Number(ln.interest_rate);
      const partialMonth = ln.last_partial_repayment_month as string | null;
      if (partialMonth && (partialMonth === prevMonthYYYYMM || partialMonth === monthYYYYMM)) {
        newStreak += 1;
        if (newStreak >= 3 && reductionApplied < 0.5) {
          const cut = Math.min(0.1, 0.5 - reductionApplied);
          newRate = Math.max(1, newRate - cut);
          reductionApplied = Math.round((reductionApplied + cut) * 100) / 100;
          ledgerRows.push({ player_id: userId, type: "loyalty_rate", amount: 0, property_id: propIdForLoan, description: `Loyalty rate reduction — ${cut.toFixed(2)}% off` });
        }
      } else {
        newStreak = 0;
      }

      // Payment holiday: skip repayment, capitalise interest, clear flag.
      if (ln.holiday_active) {
        const newBalance = balance + interest;
        await supabase.from("loans").update({
          balance: newBalance,
          holiday_active: false,
          interest_rate: newRate,
          overpayment_streak: 0,
          rate_reduction_applied: reductionApplied,
        } as any).eq("id", ln.id);
        ln.balance = newBalance;
        ledgerRows.push({ player_id: userId, type: "loan_holiday", amount: 0, property_id: propIdForLoan, description: "Payment holiday — interest capitalised" });
        continue;
      }

      const basePayment = Number(ln.monthly_payment);
      const adjustedPayment = rateModifier !== 0
        ? computeMonthlyPayment(Number(ln.principal), Number(ln.interest_rate) + rateModifier, Number(ln.term_months))
        : basePayment;
      const payment = Math.min(adjustedPayment, balance + interest);
      const principalPaid = payment - interest;
      const newBalance = Math.max(0, balance - principalPaid);

      // Insurance covers payment if tenant has missed 2+ consecutive payments.
      const tenantForLoan = tenantByPP.get(ln.player_property_id);
      const insuranceCovers = ln.insurance_active && tenantForLoan && Number(tenantForLoan.consecutive_missed_payments) >= 2;
      if (insuranceCovers) {
        ledgerRows.push({ player_id: userId, type: "insurance_payout", amount: 0, property_id: propIdForLoan, description: "Loan insurance payout — bond covered" });
      } else {
        loanTotal += payment;
        ledgerRows.push({ player_id: userId, type: "loan", amount: -payment, property_id: propIdForLoan, description: "Bond repayment" });
      }

      const updates: any = {
        balance: newBalance,
        interest_rate: newRate,
        overpayment_streak: newStreak,
        rate_reduction_applied: reductionApplied,
      };
      if (newBalance <= 0.5) updates.active = false;
      await supabase.from("loans").update(updates).eq("id", ln.id);
      ln.balance = newBalance;
      ln.interest_rate = newRate;
      ln.overpayment_streak = newStreak;
      ln.rate_reduction_applied = reductionApplied;
    }

    // Assistants payroll
    if (assistantCostMonthly > 0) {
      ledgerRows.push({ player_id: userId, type: "payroll", amount: -assistantCostMonthly, description: "Assistant salary" });
    }

    const net = rentTotal - maintTotal - loanTotal - assistantCostMonthly;
    cash += net;

    // ----- Track peak net worth -----
    {
      const portfolio = ((pps as any[]) ?? []).reduce((s: number, p: any) => s + Number(p.current_value), 0);
      const debtBalance = (loans ?? []).reduce((s, l) => s + Number(l.balance), 0);
      const nw = cash + portfolio - debtBalance;
      if (nw > peakNW) peakNW = nw;
    }

    // ----- Red Zone escalation -----
    if (cash < 0) {
      if (!redZoneStart) redZoneStart = d;
      const dayInRed = Math.floor(
        (new Date(d + "T00:00:00").getTime() - new Date(redZoneStart + "T00:00:00").getTime()) / 86400000
      ) + 1;

      // Day 1: a random rented tenant leaves immediately
      if (dayInRed === 1) {
        const rented = ((pps as any[]) ?? []).filter((p: any) => p.status === "rented");
        if (rented.length) {
          const victim = rented[Math.floor(Math.random() * rented.length)];
          await (supabase as any).from("tenants").delete().eq("player_property_id", victim.id);
          tenantByPP.delete(victim.id);
          await supabase.from("player_properties").update({ status: "vacant" }).eq("id", victim.id);
          victim.status = "vacant";
          ledgerRows.push({ player_id: userId, type: "vacancy_shock", amount: 0, property_id: victim.property_id, description: "Vacancy shock — tenant left abruptly (Red Zone Day 1)" });
          await generateApplicants({ userId, playerPropertyId: victim.id, property: (victim as any).properties as any });
        }
      }
      // Day 2: force-sell lowest value at -15%
      if (dayInRed === 2 && (pps ?? []).length > 0) {
        const sorted = [...((pps as any[]) ?? [])].sort((a: any, b: any) => Number(a.current_value) - Number(b.current_value));
        const victim = sorted[0];
        const value = Math.round(Number(victim.current_value) * 0.85);
        const commission = Math.round(value * 0.05);
        const { data: lns } = await supabase.from("loans").select("balance").eq("player_property_id", victim.id).eq("active", true);
        const bond = (lns ?? []).reduce((s, l) => s + Number(l.balance), 0);
        const net = value - commission - bond;
        await finaliseSale({ userId, playerPropertyId: victim.id, value, commission, bond, net });
        cash += net;
        ledgerRows.push({ player_id: userId, type: "fire_sale", amount: 0, property_id: victim.property_id, description: "Forced sale at -15% (Red Zone Day 2)" });
      }
      // Day 3: GAME OVER
      if (dayInRed >= 3) {
        gameOver = true;
      }
    } else {
      redZoneStart = null;
    }

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

    if (gameOver) break;

    // Try to roll a luck event for this day
    await maybeRollLuckEvent(userId, d, lastLuck, (pps ?? []).length > 0);
    // Refresh lastLuck from db cheaply
    const { data: pp2 } = await supabase.from("profiles").select("last_luck_event_date, cash").eq("id", userId).single();
    if (pp2) { lastLuck = pp2.last_luck_event_date; cash = Number(pp2.cash); }
  }

  await supabase.from("profiles").update({
    cash,
    last_tick_date: todayStr,
    peak_net_worth: peakNW,
    red_zone_started_at: redZoneStart,
    game_over: gameOver,
  } as any).eq("id", userId);

  // Re-check achievements (millionaire, debt-free, etc.)
  await checkAchievements(userId);

  return lastSummary;
}
