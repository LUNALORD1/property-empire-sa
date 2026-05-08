import { supabase } from "@/integrations/supabase/client";

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  emoji: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_purchase", title: "First Purchase", description: "Bought your very first property.", emoji: "🔑" },
  { key: "landlord", title: "Landlord", description: "Own 5 properties.", emoji: "🏘️" },
  { key: "empire_builder", title: "Empire Builder", description: "Own 10 properties.", emoji: "🏗️" },
  { key: "millionaire", title: "Millionaire", description: "Reach R1,000,000 net worth.", emoji: "💰" },
  { key: "high_roller", title: "High Roller", description: "Own a property worth over R5M.", emoji: "🎩" },
  { key: "debt_free", title: "Debt Free", description: "Pay off a bond completely.", emoji: "🧾" },
  { key: "cape_town_landlord", title: "Cape Town Landlord", description: "Own 3+ properties in Cape Town.", emoji: "🏔️" },
  { key: "joburg_hustler", title: "Joburg Hustler", description: "Own 3+ properties in Johannesburg.", emoji: "🌆" },
];

export const ACHIEVEMENTS_BY_KEY: Record<string, AchievementDef> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]));

/**
 * Re-evaluate every achievement for a player and insert any newly-earned ones.
 * Returns the keys of the achievements that were just unlocked (so callers can
 * surface a toast).
 */
export async function checkAchievements(userId: string): Promise<string[]> {
  // Fetch state in parallel.
  const [profileRes, propsRes, loansRes, ownedBadgesRes] = await Promise.all([
    supabase.from("profiles").select("cash").eq("id", userId).single(),
    supabase
      .from("player_properties")
      .select("current_value, property:property_id(city:city_id(name))")
      .eq("player_id", userId),
    supabase.from("loans").select("active").eq("player_id", userId),
    supabase.from("achievements").select("badge_key").eq("player_id", userId),
  ]);

  const cash = Number(profileRes.data?.cash ?? 0);
  const props = (propsRes.data ?? []) as any[];
  const loans = loansRes.data ?? [];
  const owned = new Set((ownedBadgesRes.data ?? []).map((r: any) => r.badge_key));

  const portfolio = props.reduce((s, p) => s + Number(p.current_value), 0);
  const debt = (loans as any[]).filter((l) => l.active).reduce((s, l) => s + 0, 0); // active balance not in projection
  // Approximate debt with a quick second query if we need it for net worth — skip & query directly:
  const { data: activeBalances } = await supabase
    .from("loans").select("balance").eq("player_id", userId).eq("active", true);
  const totalDebt = (activeBalances ?? []).reduce((s, l) => s + Number(l.balance), 0);
  const nw = cash + portfolio - totalDebt;

  const cityCounts: Record<string, number> = {};
  let hasHighValueProp = false;
  for (const p of props) {
    const city = p.property?.city?.name;
    if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1;
    if (Number(p.current_value) > 5_000_000) hasHighValueProp = true;
  }

  const hasPaidOffLoan = (loans as any[]).some((l) => l.active === false);

  const earned: string[] = [];
  const tryEarn = (key: string, cond: boolean) => {
    if (cond && !owned.has(key)) earned.push(key);
  };

  tryEarn("first_purchase", props.length >= 1);
  tryEarn("landlord", props.length >= 5);
  tryEarn("empire_builder", props.length >= 10);
  tryEarn("millionaire", nw >= 1_000_000);
  tryEarn("high_roller", hasHighValueProp);
  tryEarn("debt_free", hasPaidOffLoan);
  tryEarn("cape_town_landlord", (cityCounts["Cape Town"] ?? 0) >= 3);
  tryEarn("joburg_hustler", (cityCounts["Johannesburg"] ?? 0) >= 3);

  if (earned.length === 0) return [];

  await supabase
    .from("achievements")
    .upsert(
      earned.map((k) => ({ player_id: userId, badge_key: k })),
      { onConflict: "player_id,badge_key", ignoreDuplicates: true },
    );

  return earned;
}