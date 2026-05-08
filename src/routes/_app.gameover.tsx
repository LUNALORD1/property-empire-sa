import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAchievements, useProfile } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import { resetPlayer } from "@/lib/tenants";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skull, Trophy, Building2, RefreshCw, Crown, Loader2, Award, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";

export const Route = createFileRoute("/_app/gameover")({
  head: () => ({
    meta: [
      { title: "Game Over — Property Empire SA" },
      { name: "description", content: "Your run ended. Review your stats and start again." },
    ],
  }),
  component: GameOverPage,
});

function GameOverPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: achievements } = useAchievements(user?.id);

  const [stats, setStats] = useState<{
    totalProps: number;
    bestProperty: { suburb: string; value: number } | null;
    longestTenancy: { name: string; days: number; suburb: string } | null;
    daysPlayed: number;
    totalRentEarned: number;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!user?.id || !profile) return;
    let cancelled = false;
    (async () => {
      // best property ever owned (max value from sales OR remaining holdings)
      const [{ data: bestSold }, { data: ownedNow }, { data: rentRows }, { data: ticks }] = await Promise.all([
        supabase
          .from("ledger")
          .select("amount, property_id, properties:property_id(suburb)")
          .eq("player_id", user.id)
          .eq("type", "sale")
          .order("amount", { ascending: false })
          .limit(1),
        supabase
          .from("player_properties")
          .select("current_value, property:property_id(suburb)")
          .eq("player_id", user.id)
          .order("current_value", { ascending: false })
          .limit(1),
        supabase.from("ledger").select("amount").eq("player_id", user.id).eq("type", "rent"),
        supabase.from("daily_ticks").select("tick_date").eq("player_id", user.id).order("tick_date", { ascending: true }),
      ]);
      // longest tenancy: scan ledger for "Rent — X" runs by property — fall back to "—"
      const totalRent = (rentRows ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      const tickDates = (ticks ?? []).map((t: any) => t.tick_date);
      const daysPlayed = tickDates.length;

      // Longest tenancy from rent ledger streaks per (property_id, renter_type display name)
      const { data: tenantRows } = await supabase
        .from("ledger")
        .select("property_id, description, created_at, properties:property_id(suburb)")
        .eq("player_id", user.id)
        .eq("type", "rent")
        .order("created_at", { ascending: true });
      let longest: { name: string; days: number; suburb: string } | null = null;
      const streaks = new Map<string, { count: number; suburb: string; name: string }>();
      for (const r of (tenantRows ?? []) as any[]) {
        const key = `${r.property_id}::${r.description}`;
        const cur = streaks.get(key);
        const next = cur ? cur.count + 1 : 1;
        const name = String(r.description ?? "").replace("Rent — ", "");
        streaks.set(key, { count: next, suburb: r.properties?.suburb ?? "—", name });
        if (!longest || next > longest.days) longest = { days: next, suburb: r.properties?.suburb ?? "—", name };
      }

      const soldRow = (bestSold ?? [])[0] as any;
      const ownedRow = (ownedNow ?? [])[0] as any;
      const soldVal = soldRow ? Number(soldRow.amount) : 0;
      const ownedVal = ownedRow ? Number(ownedRow.current_value) : 0;
      let bestProperty: { suburb: string; value: number } | null = null;
      if (ownedVal >= soldVal && ownedRow) {
        bestProperty = { suburb: ownedRow.property?.suburb ?? "Unknown suburb", value: ownedVal };
      } else if (soldRow) {
        bestProperty = { suburb: soldRow.properties?.suburb ?? "Unknown suburb", value: soldVal };
      }

      if (cancelled) return;
      setStats({
        totalProps: Number((profile as any).total_properties_ever ?? 0),
        bestProperty,
        longestTenancy: longest,
        daysPlayed,
        totalRentEarned: totalRent,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile]);

  // If the player has no game_over flag, send them home
  useEffect(() => {
    if (profile && !(profile as any).game_over) nav({ to: "/" });
  }, [profile, nav]);

  async function onReset() {
    if (!user?.id || resetting) return;
    setResetting(true);
    try {
      await resetPlayer(user.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile", user.id] }),
        qc.invalidateQueries({ queryKey: ["player_properties", user.id] }),
        qc.invalidateQueries({ queryKey: ["loans", user.id] }),
        qc.invalidateQueries({ queryKey: ["ledger", user.id] }),
        qc.invalidateQueries({ queryKey: ["tenants", user.id] }),
      ]);
      nav({ to: "/" });
    } catch {
      setResetting(false);
    }
  }

  const peak = Number((profile as any)?.peak_net_worth ?? 0);
  const earned = (achievements ?? []).length;

  return (
    <div className="fixed inset-0 z-[1000] bg-[oklch(0.13_0.04_265)] overflow-y-auto">
      {/* Vignette + scarlet glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.18_25/0.35),transparent_60%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,oklch(0.05_0_0/0.6),transparent_70%)]" />

      <div className="relative max-w-xl mx-auto px-6 pt-16 pb-12 space-y-8">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-400/40 grid place-items-center shadow-[0_0_60px_-10px] shadow-red-500/40">
            <Skull className="w-10 h-10 text-red-300" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-red-300/80 font-semibold">Bankrupt</div>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white mt-2">
              Game Over
            </h1>
            <p className="text-sm text-white/60 mt-3 max-w-sm mx-auto">
              You ran out of cash for too long. Your portfolio has been liquidated. Take a breath —
              every empire begins with a single deal.
            </p>
          </div>
        </div>

        {!stats ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <Hero
              icon={<Crown className="w-5 h-5" />}
              label="Peak net worth"
              value={formatZAR(peak)}
              accent="from-amber-400 to-yellow-300"
            />

            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={<Building2 className="w-4 h-4" />}
                label="Properties owned"
                value={String(stats.totalProps)}
              />
              <Stat
                icon={<Calendar className="w-4 h-4" />}
                label="Days survived"
                value={String(stats.daysPlayed)}
              />
              <Stat
                icon={<Trophy className="w-4 h-4" />}
                label="Rent collected"
                value={formatZAR(stats.totalRentEarned, { compact: true })}
              />
              <Stat
                icon={<Award className="w-4 h-4" />}
                label="Achievements"
                value={`${earned}`}
              />
            </div>

            {stats.bestProperty && (
              <Memento
                icon={<Building2 className="w-5 h-5" />}
                title="Your crown jewel"
                primary={stats.bestProperty.suburb}
                secondary={`Sold for ${formatZAR(stats.bestProperty.value)}`}
              />
            )}

            {stats.longestTenancy && (
              <Memento
                icon={<Trophy className="w-5 h-5" />}
                title="Longest tenancy"
                primary={stats.longestTenancy.name}
                secondary={`${stats.longestTenancy.days} months in ${stats.longestTenancy.suburb}`}
              />
            )}

            {!!achievements?.length && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-semibold mb-3">
                  Badges you keep forever
                </div>
                <div className="flex flex-wrap gap-2">
                  {achievements.map((a: any) => {
                    const def = ACHIEVEMENTS_BY_KEY[a.badge_key];
                    return (
                      <div
                        key={a.id}
                        title={def?.description ?? ""}
                        className="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-100 text-xs font-medium"
                      >
                        <span className="mr-1">{def?.emoji ?? "🏅"}</span>
                        {def?.title ?? a.badge_key}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 animate-fade-in">
          <Button
            disabled={resetting}
            onClick={onReset}
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-[oklch(0.15_0.04_265)] hover:opacity-95 shadow-[0_10px_40px_-10px_oklch(0.85_0.18_85/0.6)]"
          >
            {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {resetting ? "Resetting…" : "Start again"}
          </Button>
          <p className="text-center text-[11px] text-white/40 mt-2">
            Your achievement badges carry over. Everything else resets to R350,000 cash.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-white mt-1">{value}</div>
    </div>
  );
}

function Hero({
  icon,
  label,
  value,
  accent,
}: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 via-amber-300/5 to-transparent p-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 font-semibold flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-4xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-r ${accent} mt-1`}>
        {value}
      </div>
    </div>
  );
}

function Memento({
  icon,
  title,
  primary,
  secondary,
}: { icon: React.ReactNode; title: string; primary: string; secondary: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 grid place-items-center text-amber-200">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">{title}</div>
        <div className="font-bold text-white truncate">{primary}</div>
        <div className="text-xs text-white/60 truncate">{secondary}</div>
      </div>
    </div>
  );
}