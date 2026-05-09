import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { X, Wrench, CloudRain, User, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatZAR } from "@/lib/format";
import { computeMonthlyRent } from "@/lib/game";
import { rentMetaFor } from "@/lib/renter-meta";

type Props = {
  property: any;
  tenant?: any;
  city?: { name?: string; weather_label?: string; weather_multiplier?: number };
  todayPct: number;
  onClose: () => void;
};

export function PropertyImpactModal({ property, tenant, city, todayPct, onClose }: Props) {
  const condition = Number(property.condition_score ?? 100);
  const conditionPenalty = condition < 70 ? Math.round((70 - condition) * 0.5) : 0; // display only
  const conditionWarn = condition < 70;

  const weatherMult = Number(city?.weather_multiplier ?? 1);
  const estMarketRent = property.property ? computeMonthlyRent(property.property) : Number(property.monthly_rent);
  const actualRent = tenant ? Number(tenant.monthly_rent) : 0;
  const meta = tenant ? rentMetaFor(tenant.renter_type_key) : null;
  const rentVsMarket = estMarketRent > 0 ? ((actualRent - estMarketRent) / estMarketRent) * 100 : 0;

  const todayUp = todayPct > 0;
  const todayDown = todayPct < 0;
  const TodayIcon = todayUp ? TrendingUp : todayDown ? TrendingDown : Minus;
  const todayCls = todayUp ? "text-success" : todayDown ? "text-destructive" : "text-muted-foreground";

  const nickname = property.nickname || property.property?.address;

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-center bg-black/75 backdrop-blur p-3 sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-sm bg-card border border-primary/40 rounded-2xl shadow-gold overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active modifiers</div>
              <div className="text-sm font-bold leading-tight truncate">{nickname}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 grid place-items-center" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <Row icon={<Wrench className="w-3.5 h-3.5" />}
              label="Condition"
              value={`${condition}/100`}
              hint={conditionWarn ? `Below 70 — rent demand suffers (~−${conditionPenalty}%)` : "Healthy — no rent penalty"}
              tone={conditionWarn ? "bad" : "good"}
            />
            <Row icon={<CloudRain className="w-3.5 h-3.5" />}
              label={`${city?.name ?? "City"} weather`}
              value={`×${weatherMult.toFixed(2)} maint`}
              hint={city?.weather_label ?? "Clear"}
              tone={weatherMult > 1 ? "bad" : weatherMult < 1 ? "good" : "neutral"}
            />
            <Row icon={<User className="w-3.5 h-3.5" />}
              label="Tenant rent vs market"
              value={tenant ? formatZAR(actualRent) : "Vacant"}
              hint={tenant
                ? `${meta?.label ?? tenant.renter_type_key} · ${rentVsMarket >= 0 ? "+" : ""}${rentVsMarket.toFixed(1)}% vs est. ${formatZAR(estMarketRent)}`
                : `Estimated market rent ${formatZAR(estMarketRent)}`}
              tone={!tenant ? "bad" : rentVsMarket >= 0 ? "good" : "neutral"}
            />
            <Row icon={<TodayIcon className="w-3.5 h-3.5" />}
              label="Today's value change"
              value={`${todayPct >= 0 ? "+" : ""}${todayPct.toFixed(2)}%`}
              hint={`Now ${formatZAR(Number(property.current_value), { compact: true })}`}
              tone={todayUp ? "good" : todayDown ? "bad" : "neutral"}
              valueCls={todayCls}
            />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Row({ icon, label, value, hint, tone, valueCls }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone: "good" | "bad" | "neutral"; valueCls?: string;
}) {
  const cls = valueCls ?? (tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground");
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={"text-sm font-bold tabular-nums " + cls}>{value}</div>
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}