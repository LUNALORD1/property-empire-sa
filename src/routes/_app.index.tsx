import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { PropertyCard, type BuyOptions } from "@/components/PropertyCard";
import { useAssistants, useCities, useMarketProperties, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { useAuth } from "@/hooks/use-auth";
import { bedroomsToAdminPoints, totalAdminCap, TIERS, type Property } from "@/lib/game";
import { TIER_COLORS } from "@/components/MapView";
import { buyProperty } from "@/lib/buy";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Map — Property Empire SA" },
      { name: "description", content: "Browse SA property listings on an interactive map." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cities } = useCities();
  const { data: properties } = useMarketProperties();
  const { data: owned } = usePlayerProperties(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { data: assistants } = useAssistants(user?.id);
  const [selected, setSelected] = useState<Property | null>(null);
  const [busy, setBusy] = useState(false);

  const cityById = useMemo(() => Object.fromEntries((cities ?? []).map((c) => [c.id, c])), [cities]);
  const ownedMap = useMemo(() => {
    const m: Record<string, "rented" | "vacant"> = {};
    (owned ?? []).forEach((o) => { m[o.property_id] = o.status === "rented" ? "rented" : "vacant"; });
    return m;
  }, [owned]);

  const adminUsed = bedroomsToAdminPoints(owned ?? []);
  const adminCap = totalAdminCap(profile?.admin_points_cap ?? 10, assistants ?? []);
  const canFinance = (owned?.length ?? 0) > 0;

  const markers = useMemo(() => {
    const list = [...(properties ?? [])];
    const ids = new Set(list.map((p) => p.id));
    (owned ?? []).forEach((o) => {
      if (!ids.has(o.property_id) && o.property) list.push(o.property as any);
    });
    return list;
  }, [properties, owned]);

  async function handleBuy(opts: BuyOptions) {
    if (!user || !selected) return;
    setBusy(true);
    try {
      await buyProperty({
        userId: user.id,
        property: selected,
        cash: Number(profile?.cash ?? 0),
        useBond: opts.useBond,
        ltv: opts.ltv,
        adminUsed,
        adminCap,
      });
      toast.success(`You now own ${selected.suburb}!`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["ledger", user.id] });
      qc.invalidateQueries({ queryKey: ["loans", user.id] });
      qc.invalidateQueries({ queryKey: ["achievements", user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Purchase failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0">
        <MapView properties={markers} ownedMap={ownedMap} onSelect={setSelected} cash={Number(profile?.cash ?? 0)} cities={cities} />
      </div>
      <div className="absolute bottom-20 left-3 z-[400] pointer-events-none sm:bottom-4">
        <div className="pointer-events-auto rounded-2xl bg-card/70 backdrop-blur-xl border border-border/60 px-3 py-2.5 shadow-card max-w-[260px]">
          <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-bold mb-1.5">Status</div>
          <div className="flex gap-2.5 items-center flex-wrap text-[11px] mb-2">
            <BadgeLegend color="oklch(0.62 0.18 155)" glyph="✓" label="Rented" />
            <BadgeLegend color="oklch(0.75 0.18 70)" glyph="●" label="Vacant" dark />
            <BadgeLegend color="oklch(0.58 0.20 25)" glyph="🔒" label="Too pricey" />
          </div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-bold mb-1.5">Tier (pin colour)</div>
          <div className="flex gap-2 items-center flex-wrap text-[11px]">
            {TIERS.map((t) => (
              <Legend key={t.id} color={TIER_COLORS[t.id]} label={t.short} />
            ))}
          </div>
        </div>
      </div>
      {selected && (
        <PropertyCard
          property={selected} cityName={cityById[selected.city_id]?.name}
          weatherLabel={cityById[selected.city_id]?.weather_label}
          weatherMultiplier={Number(cityById[selected.city_id]?.weather_multiplier ?? 1)}
          cash={Number(profile?.cash ?? 0)} owned={!!ownedMap[selected.id]}
          canFinance={canFinance}
          adminUsed={adminUsed} adminCap={adminCap}
          busy={busy} onClose={() => setSelected(null)} onBuy={handleBuy}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function BadgeLegend({ color, glyph, label, dark }: { color: string; glyph: string; label: string; dark?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-3.5 h-3.5 rounded-full grid place-items-center text-[8px] font-bold border border-background/80"
        style={{ background: color, color: dark ? "#1a1a1a" : "#fff" }}
      >
        {glyph}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
