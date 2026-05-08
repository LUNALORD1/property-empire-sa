import { Link, useLocation } from "@tanstack/react-router";
import { Map, Briefcase, Wallet, Store, Trophy } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Map", icon: Map },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/finances", label: "Finances", icon: Wallet },
  { to: "/market", label: "Market", icon: Store },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-card/85 backdrop-blur-md">
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-w-3xl mx-auto">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={
                "flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors text-[11px] font-medium " +
                (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className={"w-5 h-5 " + (active ? "stroke-[2.4]" : "")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
