import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { PropertyImage } from "@/components/PropertyImage";
import { formatZAR } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { X } from "lucide-react";
import type { PlayerProperty } from "@/lib/game";

export function PropertyDetailDrawer({
  property,
  history,
  onClose,
}: {
  property: PlayerProperty;
  history: Array<{ date: string; value: number }>;
  onClose: () => void;
}) {
  const nickname = (property as any).nickname as string | null | undefined;
  const cur = Number(property.current_value);
  const orig = Number(property.purchase_price);
  const pl = cur - orig;
  const plPct = orig > 0 ? (pl / orig) * 100 : 0;
  const raw = (history ?? []).slice(-30).map((h) => ({ date: h.date.slice(5), value: h.value }));
  // Pad left with purchase price so we always show >=7 points starting from purchase
  const MIN_POINTS = 7;
  const padCount = Math.max(0, MIN_POINTS - raw.length);
  const purchaseDate = (property as any).purchased_at
    ? new Date((property as any).purchased_at).toISOString().slice(5, 10)
    : "Buy";
  const padding = padCount > 0
    ? Array.from({ length: padCount }).map((_, i) => ({
        date: i === 0 ? purchaseDate : "",
        value: orig,
      }))
    : [];
  const data = [...padding, ...raw];

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-end sm:place-items-center bg-black/80 backdrop-blur p-2 sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-card overflow-hidden animate-scale-in max-h-[94vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur grid place-items-center hover:bg-background"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="aspect-[16/9] bg-muted relative">
            <PropertyImage
              propertyId={property.property?.id ?? property.property_id}
              listingPrice={property.property?.listing_price ?? property.purchase_price}
              address={property.property?.address}
              locality={property.property?.suburb}
              alt={property.property?.address}
              loading="eager"
            />
          </div>
          <div className="p-4 space-y-3 overflow-y-auto">
            <div>
              <div className="text-lg font-bold leading-tight">{nickname || property.property?.address}</div>
              {nickname && <div className="text-xs text-muted-foreground">{property.property?.address}</div>}
              <div className="text-xs text-muted-foreground">{property.property?.suburb}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Current value" value={formatZAR(cur, { compact: true })} />
              <Stat label="Purchased for" value={formatZAR(orig, { compact: true })} />
              <Stat
                label="P/L"
                value={(pl >= 0 ? "+" : "−") + formatZAR(Math.abs(pl), { compact: true })}
                tone={pl >= 0 ? "good" : "bad"}
                hint={`${pl >= 0 ? "+" : ""}${plPct.toFixed(1)}%`}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Value history
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Dashed line = purchase price
                </div>
              </div>
              <div className="h-[220px] sm:h-56 rounded-xl border border-border bg-background/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.04 260)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="oklch(0.72 0.025 250)" interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="oklch(0.72 0.025 250)"
                      width={50}
                      tickFormatter={(v) => formatZAR(Number(v), { compact: true })}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.22 0.045 260)", border: "1px solid oklch(0.32 0.04 260)", borderRadius: 8, fontSize: 14, padding: 10 }}
                      labelStyle={{ fontSize: 13, fontWeight: 600, color: "oklch(0.85 0.02 250)" }}
                      formatter={(v) => [formatZAR(Number(v)), "Value"]}
                    />
                    <ReferenceLine y={orig} stroke="oklch(0.82 0.14 85)" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="value" stroke="oklch(0.82 0.14 85)" strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-sm font-bold tabular-nums " + cls}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
