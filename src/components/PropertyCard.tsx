import { Bed, Bath, MapPin, X, TrendingUp, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { computeMonthlyRent, computeMonthlyMaintenance, type Property } from "@/lib/game";
import { useEffect } from "react";

export function PropertyCard({
  property, cityName, cash, onClose, onBuy, busy, owned,
}: {
  property: Property; cityName?: string; cash: number;
  onClose: () => void; onBuy: () => void; busy?: boolean; owned?: boolean;
}) {
  const rent = computeMonthlyRent(property);
  const maint = computeMonthlyMaintenance(property.listing_price);
  const cashflow = rent - maint;
  const yieldPct = (rent * 12) / property.listing_price * 100;
  const canAfford = cash >= property.listing_price;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-card overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/10] bg-muted">
          {property.photo_url && <img src={property.photo_url} alt={property.address} className="w-full h-full object-cover" />}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur grid place-items-center hover:bg-background" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-background/85 backdrop-blur text-xs font-medium">
            {cityName} · {property.suburb}
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-2xl font-bold text-gradient-gold tabular-nums">{formatZAR(property.listing_price)}</div>
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-0.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{property.address}</span>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1.5"><Bed className="w-4 h-4 text-primary" />{property.bedrooms} bed</span>
            <span className="flex items-center gap-1.5"><Bath className="w-4 h-4 text-primary" />{property.bathrooms} bath</span>
            <span className="flex items-center gap-1.5 ml-auto"><TrendingUp className="w-4 h-4 text-success" />{yieldPct.toFixed(1)}% yield</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Stat label="Rent / mo" value={formatZAR(rent)} good />
            <Stat label="Maint / mo" value={formatZAR(maint)} icon={<Wrench className="w-3 h-3" />} />
            <Stat label="Cashflow" value={formatZAR(cashflow)} good={cashflow > 0} />
          </div>
          {owned ? (
            <div className="rounded-xl bg-success/15 text-success border border-success/30 p-3 text-sm font-medium text-center">You own this property</div>
          ) : (
            <Button onClick={onBuy} disabled={!canAfford || busy}
              className="w-full bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold h-12 text-base">
              {canAfford ? `Buy for ${formatZAR(property.listing_price)}` : "Insufficient cash"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, good, icon }: { label: string; value: string; good?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={"text-sm font-semibold tabular-nums " + (good ? "text-success" : "")}>{value}</div>
    </div>
  );
}
