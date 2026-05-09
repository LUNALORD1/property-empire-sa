import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { useGazetteData, useLoans, useNewsHistory, useLuckEvents, useCities, usePlayerProperties } from "@/lib/data-hooks";
import { ArrowDown, ArrowUp, Minus, Clock, X, Sparkles, CloudRain, Percent, Shield, Crown, TrendingUp, BookOpen, Rocket, Layers, Users, Banknote, Sun, LineChart, AlertTriangle, Briefcase, Lightbulb, ChevronDown } from "lucide-react";
import { formatZAR } from "@/lib/format";
import { preferredTier, preferredDiscount, PRIME_RATE } from "@/lib/game";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function DailyReportModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"today" | "guide">("today");
  const { data: gazette } = useGazetteData();
  const { data: loans } = useLoans(userId);
  const { data: news } = useNewsHistory(5);
  const { data: luck } = useLuckEvents(userId);
  const { data: cities } = useCities();
  const { data: properties } = usePlayerProperties(userId);
  const qc = useQueryClient();

  // Mark report as viewed
  useEffect(() => {
    (async () => {
      await supabase.from("profiles").update({ last_report_viewed: new Date().toISOString() } as any).eq("id", userId);
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const monthYear = today.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const cityMods = (gazette?.cities ?? []) as any[];
  const todaysNews = (gazette?.news ?? []) as any[];
  const newsByCity: Record<string, any> = {};
  todaysNews.forEach((n) => { if (n.city_id) newsByCity[n.city_id] = n; });

  const rateMod = Number(gazette?.rateModifier ?? 0);
  const monthsLeft = Number(gazette?.rateMonthsLeft ?? 0);

  const ownedCount = (properties ?? []).length;
  const tier = preferredTier(ownedCount);
  const discount = preferredDiscount(ownedCount);
  const insuredCount = (loans ?? []).filter((l: any) => l.active && l.insurance_active).length;

  const recentNews = (news ?? []) as any[];
  const latestEvent = (luck ?? [])[0] as any | undefined;

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-center bg-black/80 backdrop-blur p-2 sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl max-h-[94vh] bg-card border border-primary/40 rounded-2xl shadow-gold overflow-hidden flex flex-col animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-card to-primary/15">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-gold grid place-items-center shadow-gold">
                {tab === "today" ? <Clock className="w-4 h-4 text-primary-foreground" /> : <BookOpen className="w-4 h-4 text-primary-foreground" />}
              </div>
              <div>
                <div className="text-base font-bold leading-tight">{tab === "today" ? "Daily Report" : "Game Guide"}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {tab === "today" ? `${dateLabel} · ${monthYear}` : "How everything works"}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 grid place-items-center" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex border-b border-border bg-card/50 px-2">
            <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Clock className="w-3.5 h-3.5" />}>Today</TabButton>
            <TabButton active={tab === "guide"} onClick={() => setTab("guide")} icon={<BookOpen className="w-3.5 h-3.5" />}>Guide</TabButton>
          </div>

          {tab === "today" ? (
          <div className="overflow-y-auto p-4 space-y-4">
            {/* Market modifiers */}
            <Section title="Market Modifiers" subtitle="Daily price movement by city">
              <div className="grid sm:grid-cols-2 gap-2">
                {cityMods.map((c: any) => {
                  const mod = Number(c.daily_price_modifier ?? 0);
                  const mom = Number(c.momentum_score ?? 0);
                  const up = mod > 0, down = mod < 0;
                  const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
                  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
                  const causeNews = newsByCity[c.id];
                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className={"inline-flex items-center gap-0.5 text-xs font-bold " + cls}>
                          <Icon className="w-3 h-3" />
                          {(mod * 100 >= 0 ? "+" : "") + (mod * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1">
                          {mom > 0 ? <TrendingUp className="w-3 h-3 text-success" /> : mom < 0 ? <ArrowDown className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3" />}
                          Momentum {mom > 0 ? "+" : ""}{mom}
                        </span>
                        {c.weather_label && (
                          <span className="inline-flex items-center gap-1">
                            <CloudRain className="w-3 h-3" /> {c.weather_label}
                          </span>
                        )}
                      </div>
                      {causeNews && (
                        <div className="mt-2 text-[11px] italic text-muted-foreground border-l-2 border-primary/40 pl-2">
                          {causeNews.headline}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Active modifiers */}
            <Section title="Active Modifiers">
              <div className="grid sm:grid-cols-2 gap-2">
                <ModRow icon={<Percent className="w-3.5 h-3.5" />}
                  label="SARB rate modifier"
                  value={rateMod === 0 ? "Stable" : `${rateMod > 0 ? "+" : ""}${rateMod.toFixed(2)}%`}
                  hint={rateMod !== 0 ? `${monthsLeft} mo remaining · prime ${PRIME_RATE}%` : `Prime ${PRIME_RATE}%`}
                  tone={rateMod > 0 ? "bad" : rateMod < 0 ? "good" : "neutral"}
                />
                {tier && (
                  <ModRow icon={<Crown className="w-3.5 h-3.5" />}
                    label="Preferred client"
                    value={`−${discount.toFixed(2)}%`}
                    hint={tier === "premium" ? "Premium tier (10+ properties)" : "Preferred tier (5+ properties)"}
                    tone="good"
                  />
                )}
                {insuredCount > 0 && (
                  <ModRow icon={<Shield className="w-3.5 h-3.5" />}
                    label="Loan insurance"
                    value={`${insuredCount} active`}
                    hint="Covers bond if tenant defaults"
                    tone="good"
                  />
                )}
                {(cities ?? []).filter((c: any) => Number(c.weather_multiplier ?? 1) !== 1).map((c: any) => (
                  <ModRow key={c.id} icon={<CloudRain className="w-3.5 h-3.5" />}
                    label={`${c.name} weather`}
                    value={`×${Number(c.weather_multiplier).toFixed(2)} maint`}
                    hint={c.weather_label}
                    tone={Number(c.weather_multiplier) > 1 ? "bad" : "good"}
                  />
                ))}
              </div>
            </Section>

            {/* Recent news */}
            <Section title="Recent News" subtitle="Last 5 ticker headlines">
              {recentNews.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No recent news.</div>
              ) : (
                <div className="space-y-1.5">
                  {recentNews.map((n) => {
                    const m = Number(n.price_modifier ?? 0);
                    const up = m > 0, down = m < 0;
                    const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
                    const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
                    return (
                      <div key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/40 p-2.5">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatDate(n.tick_date)}</div>
                          <div className="text-xs font-medium truncate">{n.headline}</div>
                        </div>
                        {m !== 0 && (
                          <div className={"shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold " + cls}>
                            <Icon className="w-3 h-3" />
                            {(m * 100 >= 0 ? "+" : "") + (m * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Latest random event */}
            <Section title="Latest Random Event">
              {!latestEvent ? (
                <div className="text-xs text-muted-foreground italic">No random events yet — check back tomorrow.</div>
              ) : (
                <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-card to-primary/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <div className="text-sm font-bold">{latestEvent.title}</div>
                    </div>
                    {Number(latestEvent.amount) !== 0 && (
                      <div className={"text-sm font-bold tabular-nums " + (Number(latestEvent.amount) >= 0 ? "text-success" : "text-destructive")}>
                        {Number(latestEvent.amount) >= 0 ? "+" : "−"}{formatZAR(Math.abs(Number(latestEvent.amount)))}
                      </div>
                    )}
                  </div>
                  {latestEvent.description && (
                    <div className="text-xs text-muted-foreground mt-1">{latestEvent.description}</div>
                  )}
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
                    {new Date(latestEvent.created_at).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-primary">{title}</h2>
        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function ModRow({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; tone: "good" | "bad" | "neutral";
}) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={"text-sm font-bold tabular-nums " + cls}>{value}</div>
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}