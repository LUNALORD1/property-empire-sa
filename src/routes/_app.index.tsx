import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { PropertyCard } from "@/components/PropertyCard";
import { useCities, useMarketProperties, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { useAuth } from "@/hooks/use-auth";
import { computeMonthlyRent, computeMonthlyMaintenance, type Property } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
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
  const [selected, setSelected] = useState<Property | null>(null);
  const [busy, setBusy] = useState(false);

  const cityById = useMemo(() => Object.fromEntries((cities ?? []).map((c) => [c.id, c])), [cities]);
  const ownedMap = useMemo(() => {
    const m: Record<string, "rented" | "vacant"> = {};
    (owned ?? []).forEach((o) => { m[o.property_id] = o.status === "rented" ? "rented" : "vacant"; });
    return m;
  }, [owned]);

  const markers = useMemo(() => {
    const list = [...(properties ?? [])];
    const ids = new Set(list.map((p) => p.id));
    (owned ?? []).forEach((o) => {
      if (!ids.has(o.property_id) && o.property) list.push(o.property as any);
    });
    return list;
  }, [properties, owned]);

  async function handleBuy() {
    if (!user || !selected) return;
    if (Number(profile?.cash ?? 0) < selected.listing_price) { toast.error("Not enough cash"); return; }
    setBusy(true);
    try {
      const monthlyRent = computeMonthlyRent(selected);
      const monthlyMaint = computeMonthlyMaintenance(selected.listing_price);
      const { error: ppErr } = await supabase.from("player_properties").insert({
        player_id: user.id, property_id: selected.id,
        purchase_price: selected.listing_price, current_value: selected.listing_price,
        monthly_rent: monthlyRent, monthly_maintenance: monthlyMaint, status: "rented",
      });
      if (ppErr) throw ppErr;
      await supabase.from("properties").update({ status: "sold" }).eq("id", selected.id);
      const newCash = Number(profile?.cash ?? 0) - selected.listing_price;
      await supabase.from("profiles").update({ cash: newCash }).eq("id", user.id);
      await supabase.from("ledger").insert({
        player_id: user.id, type: "purchase", amount: -selected.listing_price,
        property_id: selected.id, description: `Bought ${selected.address}`,
      });
      toast.success(`You now own ${selected.suburb}!`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["ledger", user.id] });
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
          cash={Number(profile?.cash ?? 0)} owned={!!ownedMap[selected.id]}
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
