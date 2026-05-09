import { Building2, Wallet, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatZAR } from "@/lib/format";
import { useEffect, useState } from "react";

const RANDOM_EVENT_COOLDOWN_DAYS = 2;

export function TopBar({
  cash,
  displayName,
  lastLuckDate,
  ownsAny,
}: {
  cash: number;
  displayName?: string | null;
  lastLuckDate?: string | null;
  ownsAny?: boolean;
}) {
  const countdown = useRandomEventCountdown(lastLuckDate, ownsAny);
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-2.5 max-w-3xl mx-auto">
        <Link to="/settings" className="flex items-center gap-2.5 group" title="Settings">
          <div className="w-8 h-8 rounded-lg bg-gradient-gold grid place-items-center shadow-gold">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight tracking-tight group-hover:text-primary transition-colors">Property Empire SA</div>
            <div className="text-[10px] text-muted-foreground leading-tight group-hover:text-foreground transition-colors">
              {displayName ? `Hi, ${displayName}` : "Welcome"}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          {countdown && (
            <div
              title="Time until the next random event can occur"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-card border border-border"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-semibold tabular-nums leading-none">
                <span className="text-muted-foreground mr-1">Event</span>
                {countdown}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-sm tabular-nums">{formatZAR(cash, { compact: cash >= 100000 })}</span>
          </div>
        </div>
      </div>
      {countdown && (
        <div className="sm:hidden flex justify-center pb-1.5">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-card border border-border text-[10px] font-semibold tabular-nums">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="text-muted-foreground">Next random event</span>
            <span>{countdown}</span>
          </div>
        </div>
      )}
    </header>
  );
}

function useRandomEventCountdown(lastLuckDate: string | null | undefined, ownsAny: boolean | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!ownsAny) return null;
  if (!lastLuckDate) return "any moment";
  const next = new Date(lastLuckDate + "T00:00:00").getTime() + RANDOM_EVENT_COOLDOWN_DAYS * 86400000;
  const ms = next - Date.now();
  if (ms <= 0) return "any moment";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
