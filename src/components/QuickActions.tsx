import { Link } from "@tanstack/react-router";
import { Store, Banknote, UserPlus, ArrowRight } from "lucide-react";

type Action = {
  to: "/market" | "/profile";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  hash?: string;
};

const ACTIONS: Action[] = [
  {
    to: "/market",
    icon: Store,
    title: "Buy a property",
    desc: "Browse listings, filter by tier or city.",
  },
  {
    to: "/market",
    icon: Banknote,
    title: "Take out a bond",
    desc: "Open any listing → switch to Bond to finance it.",
  },
  {
    to: "/profile",
    icon: UserPlus,
    title: "Hire an assistant",
    desc: "Unlock more admin points to manage more deals.",
  },
];

export function QuickActions({ title = "Quick actions" }: { title?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="grid gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 px-3 py-2.5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
              <a.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{a.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{a.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}