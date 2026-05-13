import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { PropertyImage } from "@/components/PropertyImage";
import { formatZAR } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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
  const data = (history ?? []).slice(-30).map((h) => ({
    date: h.date.slice(5),
    value: h.value,
  }));

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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Value — last 30 days
              </div>
              <div className="h-44 rounded-xl border border-border bg-background/40 p-2">
                {data.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => formatZAR(Number(v), { compact: true })}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v) => formatZAR(Number(v))}
                      />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-xs text-muted-foreground italic">
                    Not enough history yet — check back tomorrow.
                  </div>
                )}
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
