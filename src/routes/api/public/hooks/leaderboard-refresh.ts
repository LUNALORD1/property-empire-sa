import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Recompute the daily leaderboard snapshot:
 *  net_worth = cash + sum(player_properties.current_value) - sum(active loans.balance)
 * Stores the top 20.
 */
export const Route = createFileRoute("/api/public/hooks/leaderboard-refresh")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);

        const [profilesRes, propsRes, loansRes] = await Promise.all([
          supabaseAdmin.from("profiles").select("id, display_name, cash"),
          supabaseAdmin.from("player_properties").select("player_id, current_value"),
          supabaseAdmin.from("loans").select("player_id, balance, active"),
        ]);

        if (profilesRes.error || propsRes.error || loansRes.error) {
          return Response.json(
            { error: profilesRes.error?.message ?? propsRes.error?.message ?? loansRes.error?.message },
            { status: 500 },
          );
        }

        const portfolioByPlayer: Record<string, { value: number; count: number }> = {};
        for (const p of propsRes.data ?? []) {
          const k = p.player_id;
          if (!portfolioByPlayer[k]) portfolioByPlayer[k] = { value: 0, count: 0 };
          portfolioByPlayer[k].value += Number(p.current_value);
          portfolioByPlayer[k].count += 1;
        }

        const debtByPlayer: Record<string, number> = {};
        for (const l of loansRes.data ?? []) {
          if (!l.active) continue;
          debtByPlayer[l.player_id] = (debtByPlayer[l.player_id] ?? 0) + Number(l.balance);
        }

        const ranked = (profilesRes.data ?? [])
          .map((p) => {
            const port = portfolioByPlayer[p.id] ?? { value: 0, count: 0 };
            const debt = debtByPlayer[p.id] ?? 0;
            return {
              player_id: p.id,
              display_name: p.display_name ?? "Anonymous",
              properties_count: port.count,
              net_worth: Number(p.cash) + port.value - debt,
            };
          })
          // Only show players that have started (own at least one property OR have done something)
          .filter((r) => r.properties_count > 0 || r.net_worth !== 350_000)
          .sort((a, b) => b.net_worth - a.net_worth)
          .slice(0, 20)
          .map((r, i) => ({ ...r, rank: i + 1, snapshot_date: today }));

        // Wipe any existing snapshot for today, then insert fresh.
        await supabaseAdmin
          .from("leaderboard_snapshots")
          .delete()
          .eq("snapshot_date", today);

        if (ranked.length > 0) {
          const { error } = await supabaseAdmin.from("leaderboard_snapshots").insert(ranked);
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true, count: ranked.length, snapshot_date: today });
      },
    },
  },
});