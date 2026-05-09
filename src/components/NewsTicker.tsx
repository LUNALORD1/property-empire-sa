import { Sparkles, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useState } from "react";
import { useMarketNews } from "@/lib/data-hooks";
import { NewsHistoryModal } from "@/components/NewsHistoryModal";

const FALLBACK = [
  { headline: "📊 Markets opening — fresh headlines arriving shortly", price_modifier: 0 },
];

export function NewsTicker() {
  const { data } = useMarketNews();
  const [open, setOpen] = useState(false);
  const news = (data && data.length ? data : FALLBACK) as Array<{
    id?: string;
    headline: string;
    price_modifier: number;
  }>;
  const items = [...news, ...news]; // duplicate for seamless loop
  return (
    <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="View news history"
      className="relative w-full overflow-hidden border-b border-border bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-colors text-left"
    >
      <div className="flex items-center pointer-events-none">
        <div className="shrink-0 z-10 px-3 py-1.5 bg-gradient-gold text-primary-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Live
        </div>
        <div className="flex animate-ticker whitespace-nowrap gap-10 pl-6 text-xs text-muted-foreground py-1.5">
          {items.map((n, i) => {
            const m = Number(n.price_modifier ?? 0);
            const up = m > 0;
            const down = m < 0;
            const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
            const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
            return (
              <span key={(n.id ?? "fallback") + "-" + i} className="shrink-0 inline-flex items-center gap-2">
                <span>{n.headline}</span>
                {m !== 0 && (
                  <span className={"inline-flex items-center gap-0.5 text-[10px] font-bold " + cls}>
                    <Icon className="w-3 h-3" />
                    {(m * 100 >= 0 ? "+" : "") + (m * 100).toFixed(1)}%
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </button>
    {open && <NewsHistoryModal onClose={() => setOpen(false)} />}
    </>
  );
}