import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, usePlayerProperties } from "@/lib/data-hooks";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { netWorth, bedroomsToAdminPoints } from "@/lib/game";
import { LogOut, Trophy, Users, Calendar } from "lucide-react";

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
  const { data: profile } = useProfile(user?.id);
  const { data: properties } = usePlayerProperties(user?.id);

  const cash = Number(profile?.cash ?? 0);
  const nw = netWorth(cash, properties ?? [], 0);
  const adminUsed = bedroomsToAdminPoints(properties ?? []);
  const cap = profile?.admin_points_cap ?? 10;
  const startedAt = profile?.game_started_at ? new Date(profile.game_started_at) : null;
  const daysPlayed = startedAt ? Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 86400000)) : 1;

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
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-sm font-semibold">Team</div>
        <p className="text-xs text-muted-foreground mt-1">Hire assistants to expand your admin point cap. Coming in the next update.</p>
      </div>
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-sm font-semibold">Achievements</div>
        <p className="text-xs text-muted-foreground mt-1">Coming soon — unlock badges for your first purchase, R1M net worth, debt-free milestones &amp; more.</p>
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
