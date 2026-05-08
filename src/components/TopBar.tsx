import { Building2, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatZAR } from "@/lib/format";

export function TopBar({ cash, displayName }: { cash: number; displayName?: string | null }) {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-2.5 max-w-3xl mx-auto">
        <Link to="/profile" className="flex items-center gap-2.5 group">
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-sm tabular-nums">{formatZAR(cash, { compact: cash >= 100000 })}</span>
        </div>
      </div>
    </header>
  );
}
