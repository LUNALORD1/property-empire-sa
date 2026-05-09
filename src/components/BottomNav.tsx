import { Link, useLocation } from "@tanstack/react-router";
import { Map, Briefcase, Wallet, Store, Compass } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Map", icon: Map },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/finances", label: "Finances", icon: Wallet },
  { to: "/market", label: "Market", icon: Store },
  { to: "/leaderboard", label: "Hub", icon: Compass },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-border bg-[oklch(0.18_0.04_260)] shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
