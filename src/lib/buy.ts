import { supabase } from "@/integrations/supabase/client";
import { computeMonthlyRent, computeMonthlyMaintenance, computeMonthlyPayment, originationRate, type Property } from "@/lib/game";
import { checkAchievements } from "@/lib/achievements";
import { generateApplicants } from "@/lib/tenants";

export async function buyProperty(opts: {
  userId: string;
  property: Property;
  cash: number;
  useBond: boolean;
  ltv: number;
  adminUsed: number;
  adminCap: number;
  termMonths?: number;
  insurance?: boolean;
  ownedCount?: number;
}) {
  const { userId, property, cash, useBond, ltv, adminUsed, adminCap } = opts;
  const termMonths = opts.termMonths ?? 240;
  const insurance = !!opts.insurance;
  const ownedCount = Number(opts.ownedCount ?? 0);
  if (adminUsed + property.bedrooms > adminCap) {
    throw new Error("Not enough admin points — hire an assistant first");
  }
  const price = Number(property.listing_price);
  const principal = useBond ? Math.round(price * (ltv / 100)) : 0;
  const deposit = price - principal;
  const upfront = useBond ? deposit : price;

  if (cash < upfront) throw new Error("Not enough cash");

  const monthlyRent = computeMonthlyRent(property);
  const monthlyMaint = computeMonthlyMaintenance(price);

  const { data: pp, error: ppErr } = await supabase
    .from("player_properties")
    .insert({
      player_id: userId,
      property_id: property.id,
      purchase_price: price,
      current_value: price,
      monthly_rent: monthlyRent,
      monthly_maintenance: monthlyMaint,
      status: "vacant",
    })
    .select("id")
    .single();
  if (ppErr) throw ppErr;

  await supabase.from("properties").update({ status: "sold" }).eq("id", property.id);
  await supabase.from("profiles").update({ cash: cash - upfront }).eq("id", userId);
  await supabase.from("ledger").insert({
    player_id: userId,
    type: useBond ? "purchase_deposit" : "purchase",
    amount: -upfront,
    property_id: property.id,
    description: useBond ? `Deposit for ${property.address}` : `Bought ${property.address}`,
  });

  if (useBond && principal > 0 && pp) {
    const rate = originationRate(ltv, ownedCount);
    const monthlyPayment = computeMonthlyPayment(principal, rate, termMonths);
    await supabase.from("loans").insert({
      player_id: userId,
      player_property_id: pp.id,
      principal,
      balance: principal,
      interest_rate: rate,
      origination_rate: rate,
      term_months: termMonths,
      monthly_payment: monthlyPayment,
      ltv,
      insurance_active: insurance,
      insurance_premium_pct: insurance ? 0.2 : 0,
    } as any);
  }

  // Generate initial applicant pool for the new vacant property
  if (pp) {
    try {
      await generateApplicants({ userId, playerPropertyId: pp.id, property: property as any });
    } catch (e) {
      // Non-fatal — pool will refresh on next monthly tick
      console.error("Failed to generate initial applicants", e);
    }
  }

  // Bump lifetime counter
  const { data: prof } = await supabase
    .from("profiles")
    .select("total_properties_ever")
    .eq("id", userId)
    .single();
  await supabase
    .from("profiles")
    .update({ total_properties_ever: Number((prof as any)?.total_properties_ever ?? 0) + 1 } as any)
    .eq("id", userId);

  const unlocked = await checkAchievements(userId);
  return { playerPropertyId: pp?.id as string | undefined, unlocked };
}
