import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { NewsTicker } from "@/components/NewsTicker";
import { useAchievements, useLuckEvents, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { processDailyTicks, type LuckEvent } from "@/lib/game";
import { DailyTickModal } from "@/components/DailyTickModal";
import { LuckEventModal } from "@/components/LuckEventModal";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { RedZoneBanner } from "@/components/RedZoneBanner";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: luckEvents } = useLuckEvents(user?.id);
  const { data: owned } = usePlayerProperties(user?.id);
  const { data: achievements } = useAchievements(user?.id);
  const seenAchievementsRef = useRef<Set<string> | null>(null);
  const [tickSummary, setTickSummary] = useState<{ rent: number; maintenance: number; net: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  // Game-over guard: route into the dramatic Game Over screen.
  useEffect(() => {
    if (!profile) return;
    if ((profile as any).game_over) nav({ to: "/gameover" });
  }, [profile, nav]);

  // Process daily ticks once when profile loads
  useEffect(() => {
    if (!user?.id || !profile) return;
    let cancelled = false;
    (async () => {
      const summary = await processDailyTicks(user.id);
      if (cancelled || !summary) return;
      setTickSummary({
        rent: Number(summary.rent_collected),
        maintenance: Number(summary.maintenance_paid),
        net: Number(summary.net_cashflow),
      });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
      qc.invalidateQueries({ queryKey: ["ledger", user.id] });
      qc.invalidateQueries({ queryKey: ["loans", user.id] });
      qc.invalidateQueries({ queryKey: ["luck_events", user.id] });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id]);

  const pendingLuck: LuckEvent | undefined = (luckEvents ?? []).find((e) => !e.acknowledged);
  const showOnboarding = !!profile && !profile.onboarded;

  // Toast newly-unlocked achievements (covers tick-driven ones).
  useEffect(() => {
    if (!achievements) return;
    const keys = new Set(achievements.map((a: any) => a.badge_key));
    if (seenAchievementsRef.current === null) {
      // First load — don't spam old badges.
      seenAchievementsRef.current = keys;
      return;
    }
    const fresh: string[] = [];
    keys.forEach((k) => { if (!seenAchievementsRef.current!.has(k)) fresh.push(k); });
    fresh.forEach((k) => {
      const a = ACHIEVEMENTS_BY_KEY[k];
      if (a) toast(`${a.emoji} Achievement unlocked: ${a.title}`, { description: a.description });
    });
    seenAchievementsRef.current = keys;
  }, [achievements]);

  async function ackLuck() {
    if (!pendingLuck || !user) return;
    await supabase.from("luck_events").update({ acknowledged: true }).eq("id", pendingLuck.id);
    qc.invalidateQueries({ queryKey: ["luck_events", user.id] });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar
        cash={Number(profile?.cash ?? 0)}
        displayName={profile?.display_name}
        lastLuckDate={profile?.last_luck_event_date ?? null}
        ownsAny={(owned?.length ?? 0) > 0}
      />
      <RedZoneBanner
        cash={Number(profile?.cash ?? 0)}
        redZoneStartedAt={(profile as any)?.red_zone_started_at ?? null}
      />
      <NewsTicker />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
      <BottomNav />
      {tickSummary && tickSummary.rent + tickSummary.maintenance > 0 && (
        <DailyTickModal
          rent={tickSummary.rent}
          maintenance={tickSummary.maintenance}
          net={tickSummary.net}
          onClose={() => setTickSummary(null)}
        />
      )}
      {!tickSummary && pendingLuck && (
        <LuckEventModal event={pendingLuck} onClose={ackLuck} />
      )}
      {showOnboarding && user && (
        <OnboardingFlow
          userId={user.id}
          displayName={profile?.display_name}
          ownsAny={(owned?.length ?? 0) > 0}
          onComplete={() => qc.invalidateQueries({ queryKey: ["profile", user.id] })}
        />
      )}
    </div>
  );
}