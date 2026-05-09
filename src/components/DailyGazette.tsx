import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { useGazetteData, useLatestTick, useLuckEvents } from "@/lib/data-hooks";
import { formatZAR, formatSigned } from "@/lib/format";
import { ArrowDown, ArrowUp, Minus, Newspaper, X } from "lucide-react";

export function DailyGazette({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data } = useGazetteData();
  const { data: tick } = useLatestTick(userId);
  const { data: luck } = useLuckEvents(userId);
  const latestEvent = (luck ?? [])[0] ?? null;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-ZA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const news = (data?.news ?? []) as any[];
  const cities = (data?.cities ?? []) as any[];

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-center bg-black/80 backdrop-blur p-2 sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl max-h-[94vh] overflow-hidden bg-[#f4ecd8] text-[#1a1410] rounded-lg shadow-2xl flex flex-col animate-scale-in"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="overflow-y-auto px-5 sm:px-8 py-6">
            {/* Masthead */}
            <div className="text-center border-b-4 border-double border-black pb-3">
              <div className="text-[10px] uppercase tracking-[0.4em] font-semibold">Est. 2026 — South Africa</div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Property Empire Gazette
              </h1>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mt-2">
                <span>Vol. I · No. {dailyEditionNumber()}</span>
                <span className="flex items-center gap-1"><Newspaper className="w-3 h-3" /> Today's Edition</span>
                <span>{dateLabel}</span>
              </div>
            </div>

            {/* Lead headline */}
            <section className="mt-5">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold border-b border-black/40 pb-1 mb-2">Today's Headlines</div>
              {news.length === 0 ? (
                <p className="text-sm italic">Markets are quiet today — no major events to report.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {news.map((n, i) => (
                    <article key={n.id ?? i} className={i === 0 ? "sm:col-span-2" : ""}>
                      <h2 className={(i === 0 ? "text-2xl sm:text-3xl" : "text-lg") + " font-black leading-tight"} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {n.headline}
                      </h2>
                      <div className="flex items-center gap-3 text-[11px] mt-1 uppercase tracking-wider">
                        <PriceArrow mod={Number(n.price_modifier ?? 0)} />
                        {Number(n.rate_delta ?? 0) !== 0 && (
                          <span className="text-[#7a1a1a] font-semibold">
                            SARB rate {Number(n.rate_delta) > 0 ? "+" : ""}{Number(n.rate_delta).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Market Summary */}
            <section className="mt-6 border-t-2 border-black pt-3">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold border-b border-black/40 pb-1 mb-2">Market Summary</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {cities.map((c: any) => {
                  const m = Number(c.daily_price_modifier ?? 0) * 100;
                  return (
                    <div key={c.id} className="text-center border border-black/20 rounded p-2 bg-[#fbf6e9]">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">{c.name}</div>
                      <div className="text-lg font-bold mt-0.5">
                        <PriceArrow mod={m / 100} large />
                      </div>
                      <div className="text-[10px] opacity-60">momentum {Number(c.momentum_score ?? 0) > 0 ? "+" : ""}{c.momentum_score}</div>
                    </div>
                  );
                })}
              </div>
              {data && data.rateModifier !== 0 && (
                <div className="text-[11px] mt-3 italic text-[#7a1a1a]">
                  SARB effective rate modifier currently {data.rateModifier > 0 ? "+" : ""}
                  {data.rateModifier.toFixed(2)}% — {data.rateMonthsLeft} month{data.rateMonthsLeft === 1 ? "" : "s"} remaining.
                </div>
              )}
            </section>

            <div className="mt-6 grid sm:grid-cols-2 gap-6">
              {/* Personal panel */}
              <section className="border-t-2 border-black pt-3">
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold border-b border-black/40 pb-1 mb-2">Your Empire — Daily Ledger</div>
                {tick ? (
                  <dl className="text-sm space-y-1">
                    <PersonalRow label="Rent collected" value={"+" + formatZAR(Number(tick.rent_collected))} good />
                    <PersonalRow label="Maintenance" value={"−" + formatZAR(Number(tick.maintenance_paid))} />
                    <PersonalRow label="Bond repayments" value={"−" + formatZAR(Number((tick as any).loan_paid ?? 0))} />
                    <div className="border-t border-black/30 pt-1 mt-1 flex justify-between font-bold text-base">
                      <span>Net cash flow</span>
                      <span>{formatSigned(Number(tick.net_cashflow))}</span>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm italic">No activity recorded yet today.</p>
                )}
              </section>

              {/* Human interest */}
              <section className="border-t-2 border-black pt-3">
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold border-b border-black/40 pb-1 mb-2">Random Event</div>
                {latestEvent ? (
                  <article>
                    <h3 className="text-lg font-black leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {latestEvent.title}
                    </h3>
                    <p className="text-sm mt-1 italic">{latestEvent.description}</p>
                    {Number(latestEvent.amount) !== 0 && (
                      <div className="text-[11px] mt-1 uppercase tracking-wider opacity-75">
                        Impact: {formatSigned(Number(latestEvent.amount))}
                      </div>
                    )}
                  </article>
                ) : (
                  <p className="text-sm italic">Quiet personal week — no notable events to report.</p>
                )}
              </section>
            </div>
          </div>

          <div className="border-t-4 border-double border-black p-3 bg-[#ece2c8]">
            <Button onClick={onClose} className="w-full bg-black hover:bg-black/85 text-[#f4ecd8] font-semibold tracking-widest h-11 uppercase">
              Close Edition
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function dailyEditionNumber() {
  const start = new Date(2026, 0, 1).getTime();
  return Math.max(1, Math.floor((Date.now() - start) / 86_400_000));
}

function PriceArrow({ mod, large }: { mod: number; large?: boolean }) {
  const pct = mod * 100;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0 && !flat;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const color = flat ? "#5b574c" : up ? "#1d6a3b" : "#9b1c1c";
  return (
    <span className={"inline-flex items-center gap-1 font-bold " + (large ? "text-lg" : "text-[11px]")} style={{ color }}>
      <Icon className={large ? "w-4 h-4" : "w-3 h-3"} />
      {(pct >= 0 ? "+" : "") + pct.toFixed(2)}%
    </span>
  );
}

function PersonalRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-black/70">{label}</span>
      <span className={"font-semibold tabular-nums " + (good ? "text-[#1d6a3b]" : "")}>{value}</span>
    </div>
  );
}