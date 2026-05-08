import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLeaderboard } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import { Trophy, Building2, Crown, Medal } from "lucide-react";

export const Route = createFileRoute("/_app/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Property Empire SA" },
      { name: "description", content: "Top 20 SA property empires ranked by net worth." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useLeaderboard();
  const rows = data?.rows ?? [];
  const date = data?.date;

  return (
    <div className="p-4 max-w-3xl mx-auto w-full overflow-y-auto pb-8 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" /> Leaderboard
        </h1>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {date
            ? `Updated ${new Date(date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
            : "Awaiting first refresh"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Top 20 empires across South Africa, ranked by net worth. Refreshed daily.
      </p>

      {isLoading && <div className="text-sm text-muted-foreground py-10 text-center">Loading rankings…</div>}
      {!isLoading && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center space-y-2">
          <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <div className="text-sm font-semibold">No rankings yet</div>
          <div className="text-xs text-muted-foreground max-w-xs mx-auto">
            The leaderboard refreshes every night at 22:00. Buy your first property and check back tomorrow.
          </div>
        </div>
      ) : (
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {rows.map((r: any) => {
          const isMe = r.player_id === user?.id;
          return (
            <div
              key={r.id}
              className={
                "flex items-center gap-3 px-3 py-3 transition-colors " +
                (isMe ? "bg-primary/10" : "")
              }
            >
              <RankBadge rank={r.rank} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {r.display_name || "Anonymous"}
                  {isMe && <span className="text-[9px] uppercase tracking-wider text-primary font-bold">You</span>}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {r.properties_count} {r.properties_count === 1 ? "property" : "properties"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-gradient-gold">
                  {formatZAR(Number(r.net_worth), { compact: true })}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">net worth</div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Tile className="bg-gradient-gold text-primary-foreground shadow-gold"><Crown className="w-4 h-4" /></Tile>;
  if (rank === 2) return <Tile className="bg-muted text-foreground border border-border"><Medal className="w-4 h-4" /></Tile>;
  if (rank === 3) return <Tile className="bg-accent/20 text-accent border border-accent/30"><Medal className="w-4 h-4" /></Tile>;
  return <Tile className="bg-muted/40 text-muted-foreground border border-border tabular-nums text-sm font-bold">{rank}</Tile>;
}
function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"w-9 h-9 rounded-xl grid place-items-center shrink-0 " + className}>{children}</div>;
}