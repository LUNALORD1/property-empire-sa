import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { PropertyCard, type BuyOptions } from "@/components/PropertyCard";
import { useAssistants, useCities, useLoans, useMarketProperties, usePlayerProperties, useProfile, useTenants } from "@/lib/data-hooks";
import { useAuth } from "@/hooks/use-auth";
import { bedroomsToAdminPoints, totalAdminCap, type Property } from "@/lib/game";
import { buyProperty } from "@/lib/buy";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AcquisitionCelebration } from "@/components/AcquisitionCelebration";

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
  const { data: loans } = useLoans(user?.id);
  const { data: tenants } = useTenants(user?.id);
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
  const monthlyIncome = (tenants ?? []).filter((t: any) => t.status === "active").reduce((s: number, t: any) => s + Number(t.monthly_rent), 0);
  const currentMonthlyPayments = (loans ?? []).filter((l: any) => l.active).reduce((s: number, l: any) => s + Number(l.monthly_payment), 0);

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
      const res = await buyProperty({
        userId: user.id,
        property: selected,
        cash: Number(profile?.cash ?? 0),
        useBond: opts.useBond,
        ltv: opts.ltv,
        adminUsed,
        adminCap,
        termMonths: opts.termMonths,
        insurance: opts.insurance,
        ownedCount: owned?.length ?? 0,
      });
      if (res.playerPropertyId) {
        setCelebrate({ property: selected, ppId: res.playerPropertyId });
      } else {
        toast.success(`You now own ${selected.suburb}!`);
      }
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
      {selected && (
        <PropertyCard
          property={selected} cityName={cityById[selected.city_id]?.name}
          weatherLabel={cityById[selected.city_id]?.weather_label}
          weatherMultiplier={Number(cityById[selected.city_id]?.weather_multiplier ?? 1)}
          cash={Number(profile?.cash ?? 0)} owned={!!ownedMap[selected.id]}
          canFinance={canFinance}
          adminUsed={adminUsed} adminCap={adminCap}
          ownedCount={owned?.length ?? 0}
          monthlyIncome={monthlyIncome}
          currentMonthlyPayments={currentMonthlyPayments}
          busy={busy} onClose={() => setSelected(null)} onBuy={handleBuy}
        />
      )}
      {celebrate && user && (
        <AcquisitionCelebration
          property={celebrate.property}
          playerPropertyId={celebrate.ppId}
          ownerName={profile?.display_name ?? "You"}
          onClose={() => {
            setCelebrate(null);
            qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
          }}
        />
      )}
    </div>
  );
}
