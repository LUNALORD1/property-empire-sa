import { supabase } from "@/integrations/supabase/client";
import { computeMonthlyRent, computeMonthlyMaintenance, computeMonthlyPayment, PRIME_RATE, type Property } from "@/lib/game";

export async function buyProperty(opts: {
  userId: string;
  property: Property;
  cash: number;
  useBond: boolean;
  ltv: number;
  adminUsed: number;
  adminCap: number;
}) {
  const { userId, property, cash, useBond, ltv, adminUsed, adminCap } = opts;
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
      status: "rented",
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
    const monthlyPayment = computeMonthlyPayment(principal, PRIME_RATE, 240);
    await supabase.from("loans").insert({
      player_id: userId,
      player_property_id: pp.id,
      principal,
      balance: principal,
      interest_rate: PRIME_RATE,
      term_months: 240,
      monthly_payment: monthlyPayment,
      ltv,
    });
  }
}
