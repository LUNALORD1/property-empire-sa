import { supabase } from "@/integrations/supabase/client";
import { computeMonthlyRent, type Property } from "@/lib/game";

// ---------- Types ----------
export type RenterType = {
  key: string;
  display_name: string;
  rent_modifier: number;
  damage_risk: "very_low" | "low" | "medium" | "high";
  reliability: number;
  lease_months: number;
  min_beds: number;
  max_beds: number | null;
  single_storey_only: boolean;
  university_only: boolean;
  low_demand_only: boolean;
  flavour: string | null;
  icon_key: string | null;
};

export type TenantApplicant = {
  id: string;
  player_id: string;
  player_property_id: string;
  renter_type_key: string;
  offered_rent: number;
  generated_at: string;
  renter_type?: RenterType;
};

export type Tenant = {
  id: string;
  player_id: string;
  player_property_id: string;
  renter_type_key: string;
  monthly_rent: number;
  lease_start: string;
  lease_end: string;
  happiness: number;
  consecutive_missed_payments: number;
  status: "active" | "evicting" | "leaving";
  created_at: string;
  renter_type?: RenterType;
};

// ---------- Demand → applicant count ----------
export const DEMAND_COUNT: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  hot: 4,
};

export const DAMAGE_RISK_PCT: Record<RenterType["damage_risk"], number> = {
  very_low: 1,
  low: 2,
  medium: 8,
  high: 18,
};

// ---------- Eligibility ----------
function isEligible(rt: RenterType, p: Pick<Property, "bedrooms"> & { single_storey?: boolean; is_university_suburb?: boolean; demand_tier?: string }) {
  if (rt.min_beds && p.bedrooms < rt.min_beds) return false;
  if (rt.max_beds != null && p.bedrooms > rt.max_beds) return false;
  if (rt.single_storey_only && !(p.single_storey ?? true)) return false;
  if (rt.university_only && !(p.is_university_suburb ?? false)) return false;
  if (rt.low_demand_only && (p.demand_tier ?? "medium") !== "low") return false;
  return true;
}

// ---------- Estimated rent (used as base for offers) ----------
export function estimatedMonthlyRent(p: Pick<Property, "listing_price" | "suburb_avg_price" | "suburb_avg_rent">) {
  return computeMonthlyRent(p);
}

// ---------- Generate applicants for a vacant property ----------
export async function generateApplicants(opts: {
  userId: string;
  playerPropertyId: string;
  property: Property & { single_storey?: boolean; is_university_suburb?: boolean; demand_tier?: string };
  /** If true, replace existing applicants with a fresh pool. Default true. */
  replace?: boolean;
  /** Override the count (otherwise computed from demand tier or vacancy time). */
  count?: number;
}) {
  const { userId, playerPropertyId, property, replace = true } = opts;
  const demand = property.demand_tier ?? "medium";
  const maxCount = DEMAND_COUNT[demand] ?? 2;
  const count = Math.max(1, Math.min(maxCount, opts.count ?? maxCount));

  // Pull renter types and filter eligible
  const { data: types } = await (supabase as any).from("renter_types").select("*");
  const allTypes = (types ?? []) as RenterType[];
  let pool = allTypes.filter((rt) => isEligible(rt, property));
  // Guarantee at least one eligible type — Opportunist is the universal fallback
  if (pool.length === 0) {
    const opp = allTypes.find((rt) => rt.key === "opportunist");
    if (opp) pool = [opp];
    else return [];
  }

  const baseRent = estimatedMonthlyRent(property);
  const picks: any[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    // Sample without replacement when possible
    const candidates = pool.filter((rt) => !used.has(rt.key));
    const choice = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length || pool.length))];
    used.add(choice.key);
    const offered = Math.round(baseRent * Number(choice.rent_modifier));
    picks.push({
      player_id: userId,
      player_property_id: playerPropertyId,
      renter_type_key: choice.key,
      offered_rent: offered,
    });
  }

  if (replace) {
    await (supabase as any).from("tenant_applicants").delete().eq("player_property_id", playerPropertyId);
  }
  // Floor: every vacant property must have at least one applicant
  if (picks.length === 0) {
    const fallback = allTypes.find((rt) => rt.key === "opportunist") ?? pool[0];
    if (fallback) {
      picks.push({
        player_id: userId,
        player_property_id: playerPropertyId,
        renter_type_key: fallback.key,
        offered_rent: Math.round(baseRent * Number(fallback.rent_modifier)),
      });
    }
  }
  if (picks.length) await (supabase as any).from("tenant_applicants").insert(picks);
  return picks;
}

/**
 * Top up applicant pool toward the demand-tier max — adds 1 fresh applicant
 * per call (different type from existing picks). Used by the daily tick.
 */
export async function topUpApplicants(opts: {
  userId: string;
  playerPropertyId: string;
  property: Property & { single_storey?: boolean; is_university_suburb?: boolean; demand_tier?: string };
}) {
  const { userId, playerPropertyId, property } = opts;
  const max = DEMAND_COUNT[property.demand_tier ?? "medium"] ?? 2;
  const { data: existing } = await (supabase as any)
    .from("tenant_applicants")
    .select("renter_type_key")
    .eq("player_property_id", playerPropertyId);
  const existingKeys = new Set((existing ?? []).map((e: any) => e.renter_type_key));
  if (existingKeys.size >= max) return;

  const { data: types } = await (supabase as any).from("renter_types").select("*");
  const allTypes = (types ?? []) as RenterType[];
  let pool = allTypes.filter((rt) => isEligible(rt, property) && !existingKeys.has(rt.key));
  if (pool.length === 0) {
    const opp = allTypes.find((rt) => rt.key === "opportunist");
    if (opp && !existingKeys.has("opportunist")) pool = [opp];
    else return;
  }
  const choice = pool[Math.floor(Math.random() * pool.length)];
  const baseRent = estimatedMonthlyRent(property);
  await (supabase as any).from("tenant_applicants").insert({
    player_id: userId,
    player_property_id: playerPropertyId,
    renter_type_key: choice.key,
    offered_rent: Math.round(baseRent * Number(choice.rent_modifier)),
  });
}

// ---------- Accept an applicant -> create tenant, mark rented ----------
export async function acceptApplicant(opts: { userId: string; applicantId: string }) {
  const { userId, applicantId } = opts;
  const { data: appRow, error: appErr } = await (supabase as any)
    .from("tenant_applicants")
    .select("*, renter_type:renter_type_key(*)")
    .eq("id", applicantId)
    .single();
  if (appErr || !appRow) throw appErr ?? new Error("Applicant not found");

  const rt: RenterType = appRow.renter_type;
  const today = new Date();
  const leaseStart = today.toISOString().slice(0, 10);
  const leaseEndDate = new Date(today);
  leaseEndDate.setDate(leaseEndDate.getDate() + rt.lease_months); // 1 real day = 1 month
  const leaseEnd = leaseEndDate.toISOString().slice(0, 10);

  // Upsert active tenant for this property (one tenant per property)
  await (supabase as any).from("tenants").delete().eq("player_property_id", appRow.player_property_id);
  const { error: insErr } = await (supabase as any).from("tenants").insert({
    player_id: userId,
    player_property_id: appRow.player_property_id,
    renter_type_key: rt.key,
    monthly_rent: appRow.offered_rent,
    lease_start: leaseStart,
    lease_end: leaseEnd,
    happiness: 80,
  });
  if (insErr) throw insErr;

  // Update player_property: rented + new monthly_rent
  await supabase
    .from("player_properties")
    .update({ status: "rented", monthly_rent: appRow.offered_rent, vacancy_started_at: null } as any)
    .eq("id", appRow.player_property_id);

  // Clear all applicants for this property
  await (supabase as any).from("tenant_applicants").delete().eq("player_property_id", appRow.player_property_id);
}

export async function declineApplicant(applicantId: string) {
  await (supabase as any).from("tenant_applicants").delete().eq("id", applicantId);
}

// ---------- Post an Ad (paid applicant generation) ----------
export const AD_COST = 2000;

export async function postTenantAd(opts: {
  userId: string;
  playerPropertyId: string;
}) {
  const { userId, playerPropertyId } = opts;

  // Load property + last ad date
  const { data: pp } = await supabase
    .from("player_properties")
    .select("id, last_ad_posted_at, property:property_id(*)")
    .eq("id", playerPropertyId)
    .single();
  if (!pp) throw new Error("Property not found");

  // One ad per in-game month (30 days)
  const last = (pp as any).last_ad_posted_at as string | null;
  if (last) {
    const diffDays = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    if (diffDays < 30) throw new Error("Ad already posted this month");
  }

  // Check funds
  const { data: prof } = await supabase.from("profiles").select("cash").eq("id", userId).single();
  const cash = Number(prof?.cash ?? 0);
  if (cash < AD_COST) throw new Error("Insufficient funds");

  const property = (pp as any).property;
  if (!property) throw new Error("Property data missing");

  // Pick a renter type not already in the pool
  const { data: existing } = await (supabase as any)
    .from("tenant_applicants")
    .select("renter_type_key")
    .eq("player_property_id", playerPropertyId);
  const existingKeys = new Set((existing ?? []).map((e: any) => e.renter_type_key));

  const { data: types } = await (supabase as any).from("renter_types").select("*");
  const allTypes = (types ?? []) as RenterType[];
  let pool = allTypes.filter((rt) => isEligible(rt, property) && !existingKeys.has(rt.key));
  if (pool.length === 0) {
    pool = allTypes.filter((rt) => isEligible(rt, property));
  }
  if (pool.length === 0) {
    const opp = allTypes.find((rt) => rt.key === "opportunist");
    if (opp) pool = [opp];
    else throw new Error("No eligible renter types");
  }
  const choice = pool[Math.floor(Math.random() * pool.length)];
  const baseRent = estimatedMonthlyRent(property);

  // Deduct cash + log + insert applicant + mark ad posted
  await supabase.from("profiles").update({ cash: cash - AD_COST }).eq("id", userId);
  await supabase.from("ledger").insert({
    player_id: userId,
    type: "expense",
    amount: -AD_COST,
    property_id: property.id,
    description: "Advertising fee",
  });
  await (supabase as any).from("tenant_applicants").insert({
    player_id: userId,
    player_property_id: playerPropertyId,
    renter_type_key: choice.key,
    offered_rent: Math.round(baseRent * Number(choice.rent_modifier)),
  });
  await supabase
    .from("player_properties")
    .update({ last_ad_posted_at: new Date().toISOString().slice(0, 10) } as any)
    .eq("id", playerPropertyId);
}

// ---------- Renew lease ----------
export async function renewTenant(opts: { tenantId: string; discount?: boolean }) {
  const { tenantId, discount = false } = opts;
  const { data: t } = await (supabase as any).from("tenants").select("*").eq("id", tenantId).single();
  if (!t) return;
  const newRent = discount ? Math.round(Number(t.monthly_rent) * 0.95) : Number(t.monthly_rent);
  const { data: rt } = await (supabase as any).from("renter_types").select("lease_months").eq("key", t.renter_type_key).single();
  const months = rt?.lease_months ?? 12;
  const today = new Date();
  const leaseEnd = new Date(today);
  leaseEnd.setDate(leaseEnd.getDate() + months);
  await (supabase as any)
    .from("tenants")
    .update({
      lease_start: today.toISOString().slice(0, 10),
      lease_end: leaseEnd.toISOString().slice(0, 10),
      monthly_rent: newRent,
    })
    .eq("id", tenantId);
  await supabase.from("player_properties").update({ monthly_rent: newRent }).eq("id", t.player_property_id);
}

// ---------- Release tenant (let them go at end of current month) ----------
export async function releaseTenant(tenantId: string) {
  // Get the player property + load full property context, then immediately
  // mark the unit vacant, log vacancy_started_at and generate a fresh applicant
  // pool — no more waiting until the next daily tick.
  const { data: t } = await (supabase as any)
    .from("tenants")
    .select("id, player_id, player_property_id")
    .eq("id", tenantId)
    .single();
  if (!t) return;
  await (supabase as any).from("tenants").delete().eq("id", tenantId);
  await supabase
    .from("player_properties")
    .update({ status: "vacant", vacancy_started_at: new Date().toISOString().slice(0, 10) } as any)
    .eq("id", t.player_property_id);

  const { data: pp } = await supabase
    .from("player_properties")
    .select("id, property:property_id(*)")
    .eq("id", t.player_property_id)
    .single();
  const property = (pp as any)?.property;
  if (property) {
    await generateApplicants({
      userId: t.player_id,
      playerPropertyId: t.player_property_id,
      property,
    });
  }
}

// ---------- Sell property ----------
export async function sellProperty(opts: { userId: string; playerPropertyId: string }) {
  const { userId, playerPropertyId } = opts;
  const { data: pp } = await supabase
    .from("player_properties")
    .select("*, property:property_id(*)")
    .eq("id", playerPropertyId)
    .single();
  if (!pp) throw new Error("Property not found");

  const value = Number(pp.current_value);
  const commission = Math.round(value * 0.05);
  const { data: loanRows } = await supabase
    .from("loans")
    .select("*")
    .eq("player_property_id", playerPropertyId)
    .eq("active", true);
  const bond = (loanRows ?? []).reduce((s, l) => s + Number(l.balance), 0);

  const grossAfterCommission = value - commission;
  const net = grossAfterCommission - bond;

  if (net < 0) throw new Error("Underwater — bond balance exceeds sale price.");

  const isRented = pp.status === "rented";
  if (isRented) {
    // 1 month notice — tick will finalise tomorrow
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    await supabase
      .from("player_properties")
      .update({ selling_notice_until: tmr.toISOString().slice(0, 10), status: "selling" } as any)
      .eq("id", playerPropertyId);
    return { pending: true, net, commission, bond };
  }

  // Vacant — finalise immediately
  await finaliseSale({ userId, playerPropertyId, value, commission, bond, net });
  return { pending: false, net, commission, bond };
}

export async function finaliseSale(opts: {
  userId: string;
  playerPropertyId: string;
  value: number;
  commission: number;
  bond: number;
  net: number;
}) {
  const { userId, playerPropertyId, value, commission, bond, net } = opts;
  const { data: pp } = await supabase
    .from("player_properties")
    .select("property_id")
    .eq("id", playerPropertyId)
    .single();

  // Settle bond
  if (bond > 0) {
    await supabase
      .from("loans")
      .update({ balance: 0, active: false })
      .eq("player_property_id", playerPropertyId);
  }

  // Add cash
  const { data: prof } = await supabase.from("profiles").select("cash").eq("id", userId).single();
  const newCash = Number(prof?.cash ?? 0) + net;
  const profileUpdate: any = { cash: newCash };
  // If this sale pulls the player back into the black, clear the Red Zone
  // counter immediately so the 3-day game-over clock stops without waiting
  // for the next daily tick.
  if (newCash >= 0) profileUpdate.red_zone_started_at = null;
  await supabase.from("profiles").update(profileUpdate).eq("id", userId);

  // Ledger entry
  await supabase.from("ledger").insert({
    player_id: userId,
    type: "sale",
    amount: net,
    property_id: pp?.property_id,
    description: `Sold property — gross R${Math.round(value).toLocaleString()}, fees R${commission.toLocaleString()}, bond R${bond.toLocaleString()}`,
  });

  // Free up listing & remove from portfolio
  if (pp?.property_id) {
    await supabase.from("properties").update({ status: "active" }).eq("id", pp.property_id);
  }
  await (supabase as any).from("tenants").delete().eq("player_property_id", playerPropertyId);
  await (supabase as any).from("tenant_applicants").delete().eq("player_property_id", playerPropertyId);
  await supabase.from("player_properties").delete().eq("id", playerPropertyId);
}

// ---------- Reset player after Game Over ----------
export async function resetPlayer(userId: string) {
  // Free all listings the player owned
  const { data: pps } = await supabase
    .from("player_properties")
    .select("property_id")
    .eq("player_id", userId);
  const propIds = (pps ?? []).map((p) => p.property_id);
  if (propIds.length) await supabase.from("properties").update({ status: "active" }).in("id", propIds);

  await Promise.all([
    (supabase as any).from("tenants").delete().eq("player_id", userId),
    (supabase as any).from("tenant_applicants").delete().eq("player_id", userId),
    supabase.from("player_properties").delete().eq("player_id", userId),
    supabase.from("loans").delete().eq("player_id", userId),
    supabase.from("daily_ticks").delete().eq("player_id", userId),
    supabase.from("luck_events").delete().eq("player_id", userId),
    supabase.from("ledger").delete().eq("player_id", userId),
    supabase.from("assistants").delete().eq("player_id", userId),
  ]);

  await supabase
    .from("profiles")
    .update({
      cash: 500000,
      game_over: false,
      red_zone_started_at: null,
      peak_net_worth: 0,
      total_properties_ever: 0,
      last_tick_date: null,
      last_luck_event_date: null,
      game_started_at: new Date().toISOString(),
    } as any)
    .eq("id", userId);
}