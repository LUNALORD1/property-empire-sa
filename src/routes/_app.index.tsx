import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { PropertyCard, type BuyOptions } from "@/components/PropertyCard";
import { useAssistants, useCities, useMarketProperties, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { useAuth } from "@/hooks/use-auth";
import { bedroomsToAdminPoints, totalAdminCap, type Property } from "@/lib/game";
import { buyProperty } from "@/lib/buy";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";

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
      const earned = await buyProperty({
        userId: user.id,
        property: selected,
        cash: Number(profile?.cash ?? 0),
        useBond: opts.useBond,
        ltv: opts.ltv,
        adminUsed,
        adminCap,
      });
      toast.success(`You now own ${selected.suburb}!`);
      (earned ?? []).forEach((k) => {
        const a = ACHIEVEMENTS_BY_KEY[k];
        if (a) toast(`${a.emoji} Achievement unlocked: ${a.title}`, { description: a.description });
      });
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
        <MapView properties={markers} ownedMap={ownedMap} onSelect={setSelected} />
      </div>
      <div className="absolute top-3 left-3 right-3 z-[400] flex justify-center pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-card/90 backdrop-blur border border-border px-3 py-1.5 text-xs flex gap-3 items-center shadow-card">
          <Legend color="oklch(0.82 0.14 85)" label="For sale" />
          <Legend color="oklch(0.62 0.18 155)" label="Rented" />
          <Legend color="oklch(0.75 0.18 70)" label="Vacant" />
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
