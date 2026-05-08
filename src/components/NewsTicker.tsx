import { Sparkles } from "lucide-react";

const NEWS = [
  "📈 SARB holds prime rate at 11.75% for the third consecutive month",
  "🏖️ Cape Town summer rentals up 8% year-on-year — coastal landlords cheering",
  "⚡ Eskom announces Stage 2 load-shedding for Gauteng this week",
  "🌧️ KZN coast braces for heavy rainfall — maintenance budgets tighten",
  "🏗️ New developments in Sandton push average prices to R4.2M",
  "💎 Property24 reports record demand in Umhlanga & Ballito",
  "📊 StatsSA: National house prices grew 4.6% over the past 12 months",
  "🎯 Centurion emerging as the most-searched suburb in Pretoria",
];

export function NewsTicker() {
  const items = [...NEWS, ...NEWS]; // duplicate for seamless loop
  return (
    <div className="relative overflow-hidden border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="flex items-center">
        <div className="shrink-0 z-10 px-3 py-1.5 bg-gradient-gold text-primary-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Live
        </div>
        <div className="flex animate-ticker whitespace-nowrap gap-12 pl-6 text-xs text-muted-foreground py-1.5">
          {items.map((n, i) => (
            <span key={i} className="shrink-0">{n}</span>
          ))}
        </div>
      </div>
    </div>
  );
}