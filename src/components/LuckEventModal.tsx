import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { Sparkles, Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { LuckEvent } from "@/lib/game";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";

export function LuckEventModal({ event, onClose }: { event: LuckEvent; onClose: () => void }) {
  const amount = Number(event.amount);
  const kind = event.payload?.kind as string | undefined;
  const value = Number(event.payload?.value ?? 0);
  const positive = kind === "cash" ? amount >= 0 : value >= 0;

  return (
    <Overlay onClose={onClose}>
    <div className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur p-4 animate-fade-in" style={{ zIndex: Z.modal }} onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-card border border-primary/40 rounded-3xl shadow-gold overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"h-1 w-full " + (positive ? "bg-success" : "bg-destructive")} />
        <div className="p-6 text-center">
          <div className={
            "w-16 h-16 rounded-2xl mx-auto grid place-items-center mb-3 " +
            (positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")
          }>
            {positive ? <Sparkles className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">
            {positive ? "Lucky break" : "Bad luck"}
          </div>
          <div className="text-2xl font-bold mb-1">{event.title}</div>
          <p className="text-sm text-muted-foreground">{event.description}</p>

          <div className="mt-5 rounded-2xl bg-muted/40 border border-border p-4">
            {kind === "cash" && (
              <div className="flex items-center justify-center gap-2">
                {positive ? <TrendingUp className="w-5 h-5 text-success" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
                <div className={"text-2xl font-bold tabular-nums " + (positive ? "text-success" : "text-destructive")}>
                  {amount >= 0 ? "+" : "−"}{formatZAR(Math.abs(amount))}
                </div>
              </div>
            )}
            {kind === "value_pct" && (
              <div className={"text-xl font-bold " + (positive ? "text-success" : "text-destructive")}>
                Property values {value >= 0 ? "+" : ""}{value.toFixed(1)}%
              </div>
            )}
            {kind === "rent_boost" && (
              <div className="text-xl font-bold text-success">
                Rents +{value.toFixed(1)}%
              </div>
            )}
          </div>

          <Button onClick={onClose} className="w-full mt-5 bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold h-11">
            Continue
          </Button>
        </div>
      </div>
    </div>
    </Overlay>
  );
}
