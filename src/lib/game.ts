import { supabase } from "@/integrations/supabase/client";
import { checkAchievements } from "@/lib/achievements";
import { finaliseSale, generateApplicants, DAMAGE_RISK_PCT, type RenterType } from "@/lib/tenants";
import { applyDailyMarket } from "@/lib/news";

export const PRIME_RATE = 11.75; // SA prime, %

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
  let peakNW = Number((profile as any).peak_net_worth ?? 0);
  let redZoneStart: string | null = (profile as any).red_zone_started_at;
  let gameOver = false;

  for (const d of days) {
    let rentTotal = 0, maintTotal = 0, loanTotal = 0;
    const ledgerRows: any[] = [];

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
          rent = Number(tenant.monthly_rent);
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
      }

      // ----- Appreciation -----
      const monthlyAppreciationPct = Number(appreciation) / 100 / 12;
      const newValue = Math.round(Number(pp.current_value) * (1 + monthlyAppreciationPct));
      ppUpdates.current_value = newValue;
      pp.current_value = newValue;

      if (Object.keys(ppUpdates).length) {
        await supabase.from("player_properties").update(ppUpdates).eq("id", pp.id);
        if (ppUpdates.status) pp.status = ppUpdates.status;
      }
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
