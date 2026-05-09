import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAssistants, useCities, useMarketProperties, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { useAuth } from "@/hooks/use-auth";
import { Bed, Bath, MapPin, TrendingUp } from "lucide-react";
import { computeMonthlyRent, bedroomsToAdminPoints, totalAdminCap, tierForPrice, TIERS, type Property } from "@/lib/game";
import { formatZAR } from "@/lib/format";
import { PropertyCard, type BuyOptions } from "@/components/PropertyCard";
import { PropertyImage } from "@/components/PropertyImage";
import { buyProperty } from "@/lib/buy";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";
import { AcquisitionCelebration } from "@/components/AcquisitionCelebration";

export const Route = createFileRoute("/_app/market")({
  head: () => ({
    meta: [
      { title: "Market — Property Empire SA" },
      { name: "description", content: "Browse all available SA listings, filter by city and price." },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cities } = useCities();
  const { data: properties } = useMarketProperties();
  const { data: profile } = useProfile(user?.id);
  const { data: owned } = usePlayerProperties(user?.id);
  const { data: assistants } = useAssistants(user?.id);
  const [city, setCity] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [selected, setSelected] = useState<Property | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<{ property: Property; ppId: string } | null>(null);

  const cityById = useMemo(() => Object.fromEntries((cities ?? []).map((c) => [c.id, c])), [cities]);
  const ownedMap = useMemo(() => {
    const m: Record<string, "rented" | "vacant"> = {};
    (owned ?? []).forEach((o) => { m[o.property_id] = o.status === "rented" ? "rented" : "vacant"; });
    return m;
  }, [owned]);

  const adminUsed = bedroomsToAdminPoints(owned ?? []);
  const adminCap = totalAdminCap(profile?.admin_points_cap ?? 10, assistants ?? []);
  const canFinance = (owned?.length ?? 0) > 0;

  const tierFilters = [
    { id: "all", label: "All tiers", min: 0, max: Infinity },
    ...TIERS.map((t) => ({ id: String(t.id), label: t.label, min: t.min, max: t.max })),
  ];

  const filtered = useMemo(() => {
    const t = tierFilters.find((x) => x.id === tier)!;
    return (properties ?? []).filter((p) => {
      if (city !== "all" && p.city_id !== city) return false;
      if (p.listing_price < t.min || p.listing_price >= t.max) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, city, tier]);

  async function handleBuy(opts: BuyOptions) {
    if (!user || !selected) return;
    setBusy(true);
    try {
      const res = await buyProperty({
        userId: user.id, property: selected,
        cash: Number(profile?.cash ?? 0),
        useBond: opts.useBond, ltv: opts.ltv,
        adminUsed, adminCap,
        termMonths: opts.termMonths,
        insurance: opts.insurance,
        ownedCount: owned?.length ?? 0,
      });
      if (res.playerPropertyId) {
        setCelebrate({ property: selected, ppId: res.playerPropertyId });
      } else {
        toast.success(`Bought ${selected.suburb}`);
      }
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["ledger", user.id] });
      qc.invalidateQueries({ queryKey: ["loans", user.id] });
      qc.invalidateQueries({ queryKey: ["achievements", user.id] });
    } catch (e: any) { toast.error(e.message ?? "Purchase failed"); } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-3">Market</h1>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Chip active={city === "all"} onClick={() => setCity("all")}>All cities</Chip>
          {(cities ?? []).map((c) => (
            <Chip key={c.id} active={city === c.id} onClick={() => setCity(c.id)}>{c.name}</Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mt-1 -mx-1 px-1">
          {tierFilters.map((t) => (
            <Chip key={t.id} active={tier === t.id} onClick={() => setTier(t.id)}>{t.label}</Chip>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {filtered.map((p) => {
            const rent = computeMonthlyRent(p);
            const yieldPct = (rent * 12) / p.listing_price * 100;
            const isOwned = !!ownedMap[p.id];
            const t = tierForPrice(p.listing_price);
            return (
              <button key={p.id} onClick={() => setSelected(p)} className="text-left rounded-2xl bg-gradient-card border border-border overflow-hidden shadow-card hover:border-primary/40 transition-colors">
                <div className="aspect-[16/10] bg-muted relative">
                  <PropertyImage listingPrice={p.listing_price} address={p.address} locality={p.suburb} alt={p.address} />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/85 text-[10px] font-medium">{cityById[p.city_id]?.name} · {p.suburb}</div>
                  {isOwned
                    ? <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-success/90 text-[10px] font-bold uppercase">Owned</div>
                    : <div className={"absolute top-2 right-2 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase backdrop-blur " + t.color}>{t.short}</div>}
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-lg font-bold text-gradient-gold tabular-nums">{formatZAR(p.listing_price, { compact: true })}</div>
                    <div className="text-xs text-success flex items-center gap-1"><TrendingUp className="w-3 h-3" />{yieldPct.toFixed(1)}%</div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-start gap-1 truncate">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="truncate">{p.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.bedrooms}</span>
                    <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.bathrooms}</span>
                    <span className="ml-auto">{formatZAR(rent)}/mo</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!filtered.length && <div className="text-sm text-muted-foreground py-10 text-center">No listings match your filters.</div>}
      </div>
      {selected && (
        <PropertyCard property={selected} cityName={cityById[selected.city_id]?.name}
          weatherLabel={cityById[selected.city_id]?.weather_label}
          weatherMultiplier={Number(cityById[selected.city_id]?.weather_multiplier ?? 1)}
          cash={Number(profile?.cash ?? 0)} owned={!!ownedMap[selected.id]}
          canFinance={canFinance} adminUsed={adminUsed} adminCap={adminCap}
          ownedCount={owned?.length ?? 0}
          busy={busy} onClose={() => setSelected(null)} onBuy={handleBuy} />
      )}
      {celebrate && (
        <AcquisitionCelebration
          property={celebrate.property}
          playerPropertyId={celebrate.ppId}
          ownerName={profile?.display_name ?? "You"}
          onClose={() => {
            setCelebrate(null);
            qc.invalidateQueries({ queryKey: ["player_properties", user!.id] });
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={"shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
        (active ? "bg-gradient-gold text-primary-foreground border-transparent shadow-gold" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}
