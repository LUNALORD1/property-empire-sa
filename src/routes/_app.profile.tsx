import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAssistants, useLoans, useProfile, usePlayerProperties } from "@/lib/data-hooks";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { netWorth, bedroomsToAdminPoints, totalAdminCap } from "@/lib/game";
import { LogOut, Trophy, Users, Calendar, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

const ASSISTANT_COST = 8000;
const ASSISTANT_POINTS = 10;

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Property Empire SA" },
      { name: "description", content: "Your player profile, stats, and team." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const { data: properties } = usePlayerProperties(user?.id);
  const { data: assistants } = useAssistants(user?.id);
  const { data: loans } = useLoans(user?.id);
  const [hiring, setHiring] = useState(false);

  const cash = Number(profile?.cash ?? 0);
  const debt = (loans ?? []).filter((l) => l.active).reduce((s, l) => s + Number(l.balance), 0);
  const nw = netWorth(cash, properties ?? [], debt);
  const adminUsed = bedroomsToAdminPoints(properties ?? []);
  const baseCap = profile?.admin_points_cap ?? 10;
  const cap = totalAdminCap(baseCap, assistants ?? []);
  const activeAssistants = (assistants ?? []).filter((a) => a.active);
  const startedAt = profile?.game_started_at ? new Date(profile.game_started_at) : null;
  const daysPlayed = startedAt ? Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 86400000)) : 1;

  const usagePct = cap > 0 ? (adminUsed / cap) * 100 : 0;

  async function hireAssistant() {
    if (!user) return;
    setHiring(true);
    try {
      const { error } = await supabase.from("assistants").insert({
        player_id: user.id,
        monthly_cost: ASSISTANT_COST,
        points_added: ASSISTANT_POINTS,
        active: true,
      });
      if (error) throw error;
      toast.success(`Hired! +${ASSISTANT_POINTS} admin points`);
      qc.invalidateQueries({ queryKey: ["assistants", user.id] });
    } catch (e: any) { toast.error(e.message ?? "Hire failed"); }
    finally { setHiring(false); }
  }

  async function fireAssistant(id: string) {
    if (!user) return;
    await supabase.from("assistants").update({ active: false }).eq("id", id);
    toast("Assistant let go");
    qc.invalidateQueries({ queryKey: ["assistants", user.id] });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto w-full overflow-y-auto pb-8 space-y-5">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="rounded-2xl bg-gradient-card border border-primary/20 shadow-gold p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-gold grid place-items-center text-primary-foreground text-xl font-bold shadow-gold">
          {(profile?.display_name ?? "P").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{profile?.display_name ?? "Player"}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Net worth</div>
          <div className="font-bold text-gradient-gold">{formatZAR(nw, { compact: true })}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Calendar className="w-4 h-4" />} label="Months played" value={daysPlayed.toString()} />
        <Stat icon={<Trophy className="w-4 h-4" />} label="Properties" value={(properties?.length ?? 0).toString()} />
        <Stat icon={<Users className="w-4 h-4" />} label="Admin pts" value={`${adminUsed}/${cap}`} />
      </div>

      {/* Admin capacity card */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm font-semibold">Admin capacity</div>
            <div className="text-xs text-muted-foreground">Each bedroom you own takes 1 point.</div>
          </div>
          <div className="text-sm font-bold tabular-nums">{adminUsed}/{cap}</div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={"h-full transition-all " + (usagePct > 90 ? "bg-destructive" : usagePct > 70 ? "bg-accent" : "bg-gradient-gold")}
            style={{ width: `${Math.min(100, usagePct)}%` }}
          />
        </div>
        {adminUsed >= cap && (
          <div className="text-[11px] text-destructive">You're at capacity — hire an assistant to unlock more deals.</div>
        )}
      </div>

      {/* Team / assistants */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm font-semibold">Team</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{activeAssistants.length} on staff</div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Each assistant adds {ASSISTANT_POINTS} admin points and costs {formatZAR(ASSISTANT_COST)}/month.
        </p>
        {activeAssistants.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {activeAssistants.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary grid place-items-center text-xs font-bold">A{i + 1}</div>
                  <div>
                    <div className="text-xs font-medium">Assistant #{i + 1}</div>
                    <div className="text-[10px] text-muted-foreground">+{a.points_added} pts · {formatZAR(Number(a.monthly_cost))}/mo</div>
                  </div>
                </div>
                <button onClick={() => fireAssistant(a.id)} className="text-[10px] uppercase font-semibold text-muted-foreground hover:text-destructive">
                  Let go
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          onClick={hireAssistant}
          disabled={hiring}
          className="w-full bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold"
        >
          <UserPlus className="w-4 h-4" /> Hire assistant · {formatZAR(ASSISTANT_COST)}/mo
        </Button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-sm font-semibold">Achievements</div>
        <p className="text-xs text-muted-foreground mt-1">Coming soon — unlock badges for milestones.</p>
      </div>
      <Button variant="outline" className="w-full bg-card hover:bg-muted border-border"
        onClick={async () => { await signOut(); nav({ to: "/login" }); }}>
        <LogOut className="w-4 h-4" /> Sign out
      </Button>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-3 text-center">
      <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary grid place-items-center mx-auto mb-1">{icon}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
