import { Bed, Bath, MapPin, X, TrendingUp, Wrench, Banknote, Wallet, CloudRain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { computeMonthlyRent, computeMonthlyMaintenance, computeMonthlyPayment, PRIME_RATE, tierForPrice, type Property } from "@/lib/game";
import { useEffect, useMemo, useState } from "react";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { PropertyImage } from "@/components/PropertyImage";

export type BuyOptions = { useBond: boolean; ltv: number; deposit: number; monthlyPayment: number };

export function PropertyCard({
  property, cityName, weatherLabel, weatherMultiplier, cash, onClose, onBuy, busy, owned, canFinance,
  adminUsed, adminCap,
}: {
  property: Property; cityName?: string; weatherLabel?: string; weatherMultiplier?: number; cash: number;
  onClose: () => void;
  onBuy: (opts: BuyOptions) => void;
  busy?: boolean; owned?: boolean;
  canFinance?: boolean;
  adminUsed: number; adminCap: number;
}) {
  const rent = computeMonthlyRent(property);
  const maint = computeMonthlyMaintenance(property.listing_price, weatherMultiplier ?? 1);
  const yieldPct = (rent * 12) / property.listing_price * 100;
  const tier = tierForPrice(property.listing_price);

  const [useBond, setUseBond] = useState(false);
  const [ltv, setLtv] = useState(85);

  const principal = Math.round(property.listing_price * (ltv / 100));
  const deposit = property.listing_price - principal;
  const monthlyPayment = useMemo(
    () => (useBond ? computeMonthlyPayment(principal, PRIME_RATE, 240) : 0),
    [useBond, principal],
  );
  const cashflow = rent - maint - monthlyPayment;
  const upfront = useBond ? deposit : property.listing_price;
  const canAfford = cash >= upfront;
  const wouldExceedCap = adminUsed + property.bedrooms > adminCap;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <Overlay onClose={onClose}>
    <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in" style={{ zIndex: Z.modal }} onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-card overflow-hidden max-h-[92vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/10] bg-muted">
          <PropertyImage propertyId={property.id} listingPrice={property.listing_price} imageUrl={(property as any).image_url} alt={property.address} loading="eager" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur grid place-items-center hover:bg-background" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-background/85 backdrop-blur text-xs font-medium">
            {cityName} · {property.suburb}
          </div>
          <div className={"absolute top-3 left-3 px-2 py-1 rounded-md border text-[10px] font-bold uppercase backdrop-blur " + tier.color}>
            {tier.label}
          </div>
          {weatherLabel && (weatherMultiplier ?? 1) > 1 && (
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-background/85 backdrop-blur text-[10px] font-semibold flex items-center gap-1 text-primary">
              <CloudRain className="w-3 h-3" />
              {weatherLabel} · maint ×{(weatherMultiplier ?? 1).toFixed(2)}
            </div>
          )}
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
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Est. rent / mo" value={formatZAR(rent)} good />
            <Stat label="Maint / mo" value={formatZAR(maint)} icon={<Wrench className="w-3 h-3" />} />
            <Stat label="Cashflow" value={formatZAR(cashflow)} good={cashflow > 0} bad={cashflow < 0} />
          </div>
          <div className="-mt-2 text-[10px] text-muted-foreground italic">
            Estimated rental income — actual rent depends on the tenant you select.
          </div>

          {!owned && (
            <>
              {/* Financing */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-primary" /> Financing
                  </div>
                  <div className="flex rounded-lg overflow-hidden border border-border text-[11px] font-semibold">
                    <button
                      type="button"
                      disabled={!canFinance && !useBond}
                      onClick={() => setUseBond(false)}
                      className={"px-2.5 py-1 transition-colors " + (!useBond ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >Cash</button>
                    <button
                      type="button"
                      disabled={!canFinance}
                      onClick={() => setUseBond(true)}
                      className={"px-2.5 py-1 transition-colors " + (useBond ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground disabled:opacity-40")}
                    >Bond</button>
                  </div>
                </div>
                {!canFinance && (
                  <div className="text-[11px] text-muted-foreground">Buy at least one property in cash to unlock home loans.</div>
                )}
                {useBond && canFinance && (
                  <>
                    <div className="flex gap-1.5 mt-1">
                      {[50, 70, 85, 90].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLtv(v)}
                          className={"flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition-colors " +
                            (ltv === v ? "bg-primary/20 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}
                        >{v}% LTV</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <Mini label="Deposit" value={formatZAR(deposit, { compact: true })} />
                      <Mini label="Loan" value={formatZAR(principal, { compact: true })} />
                      <Mini label="Repay/mo" value={formatZAR(monthlyPayment)} />
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-0.5">Prime {PRIME_RATE}% · 20-year term</div>
                  </>
                )}
              </div>

              {/* Admin capacity */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Admin points after purchase</span>
                <span className={(wouldExceedCap ? "text-destructive font-semibold" : "text-foreground font-medium")}>
                  {adminUsed + property.bedrooms} / {adminCap}
                </span>
              </div>
            </>
          )}

          {owned ? (
            <div className="rounded-xl bg-success/15 text-success border border-success/30 p-3 text-sm font-medium text-center">You own this property</div>
          ) : (
            <Button
              onClick={() => onBuy({ useBond, ltv, deposit: useBond ? deposit : property.listing_price, monthlyPayment })}
              disabled={!canAfford || busy || wouldExceedCap}
              className="w-full bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold h-12 text-base"
            >
              <Wallet className="w-4 h-4" />
              {wouldExceedCap
                ? "Hire an assistant first"
                : !canAfford
                ? `Need ${formatZAR(upfront, { compact: true })} cash`
                : useBond
                ? `Pay ${formatZAR(deposit)} deposit`
                : `Buy for ${formatZAR(property.listing_price)}`}
            </Button>
          )}
        </div>
      </div>
    </div>
    </Overlay>
  );
}

function Stat({ label, value, good, bad, icon }: { label: string; value: string; good?: boolean; bad?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={"text-sm font-semibold tabular-nums " + (good ? "text-success" : bad ? "text-destructive" : "")}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
