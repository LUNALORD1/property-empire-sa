import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { NewsTicker } from "@/components/NewsTicker";
import { useLuckEvents, useProfile } from "@/lib/data-hooks";
import { processDailyTicks, type LuckEvent } from "@/lib/game";
import { DailyTickModal } from "@/components/DailyTickModal";
import { LuckEventModal } from "@/components/LuckEventModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: luckEvents } = useLuckEvents(user?.id);
  const [tickSummary, setTickSummary] = useState<{ rent: number; maintenance: number; net: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

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
      <TopBar cash={Number(profile?.cash ?? 0)} displayName={profile?.display_name} />
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
    </div>
  );
}