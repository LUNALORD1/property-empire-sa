import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { ArrowDown, ArrowUp, Minus, Newspaper, X } from "lucide-react";
import { useNewsHistory } from "@/lib/data-hooks";

export function NewsHistoryModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useNewsHistory(20);
  const items = (data ?? []) as any[];
  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-center bg-black/75 backdrop-blur p-3 sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg max-h-[88vh] bg-card border border-primary/40 rounded-2xl shadow-gold overflow-hidden flex flex-col animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-card to-primary/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-gold grid place-items-center shadow-gold">
                <Newspaper className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">News History</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last 20 headlines</div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 grid place-items-center" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto p-4 space-y-2">
            {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
            {!isLoading && items.length === 0 && (
              <div className="text-xs text-muted-foreground italic text-center py-8">No news yet — check back tomorrow.</div>
            )}
            {items.map((n) => {
              const m = Number(n.price_modifier ?? 0);
              const up = m > 0, down = m < 0;
              const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
              const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
              return (
                <div key={n.id} className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {formatDate(n.tick_date)}
                    </div>
                    {m !== 0 && (
                      <div className={"inline-flex items-center gap-0.5 text-[11px] font-bold " + cls}>
                        <Icon className="w-3 h-3" />
                        {(m * 100 >= 0 ? "+" : "") + (m * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{n.headline}</div>
                  {Number(n.rate_delta ?? 0) !== 0 && (
                    <div className="text-[10px] text-amber-300 mt-1 font-semibold">
                      SARB rate {Number(n.rate_delta) > 0 ? "+" : ""}{Number(n.rate_delta).toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}