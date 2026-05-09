import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useApplicantsCount, useCities, useLoans, useMarketProperties, usePlayerProperties, useTenants, useValueHistory } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import {
  Bed, Bath, Building2, TrendingUp, TrendingDown, ArrowRight, UserPlus, Users,
  Heart, Tag, RefreshCw, DoorOpen, Loader2, Crown, Wrench, ChevronDown, ChevronUp,
} from "lucide-react";
import { QuickActions } from "@/components/QuickActions";
import { useEffect, useMemo, useRef, useState } from "react";
import { TenantApplicantsSheet } from "@/components/TenantApplicantsSheet";
import { SellPropertyDialog } from "@/components/SellPropertyDialog";
import { PropertyImage } from "@/components/PropertyImage";
import { Sparkline } from "@/components/Sparkline";
import { rentMetaFor } from "@/lib/renter-meta";
import { Button } from "@/components/ui/button";
import { renewTenant, releaseTenant, renovateProperty } from "@/lib/tenants";
import { tierForPrice } from "@/lib/game";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PlayerProperty } from "@/lib/game";

export const Route = createFileRoute("/_app/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Property Empire SA" },
      { name: "description", content: "Your owned properties and monthly performance." },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { user } = useAuth();
  const { data: properties, isLoading } = usePlayerProperties(user?.id);
  const { data: tenants } = useTenants(user?.id);
  const { data: applicantCounts } = useApplicantsCount(user?.id);
  const { data: history } = useValueHistory(user?.id);
  const { data: loans } = useLoans(user?.id);
  const { data: cities } = useCities();
  const { data: market } = useMarketProperties();
  const qc = useQueryClient();
  const [applicantsFor, setApplicantsFor] = useState<PlayerProperty | null>(null);
  const [sellingFor, setSellingFor] = useState<PlayerProperty | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const seenPaidOffRef = useRef<Set<string> | null>(null);

  // Loan map: was this property ever financed? Is the bond active now?
  const loansByProp = useMemo(() => {
    const m: Record<string, { hasAny: boolean; active: boolean }> = {};
    (loans ?? []).forEach((l: any) => {
      const cur = (m[l.player_property_id] ||= { hasAny: false, active: false });
      cur.hasAny = true;
      if (l.active) cur.active = true;
    });
    return m;
  }, [loans]);

  // Detect newly paid-off bonds and fire a toast once.
  useEffect(() => {
    if (!loans || !properties) return;
    const paidOffNow = new Set<string>();
    (properties ?? []).forEach((p) => {
      const li = loansByProp[p.id];
      if (li?.hasAny && !li.active) paidOffNow.add(p.id);
    });
    const STORAGE_KEY = "pe.paidOffSeen";
    if (seenPaidOffRef.current === null) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        seenPaidOffRef.current = new Set(raw ? JSON.parse(raw) : []);
      } catch { seenPaidOffRef.current = new Set(); }
      // Seed with current paid-off so we don't toast on first load
      paidOffNow.forEach((id) => seenPaidOffRef.current!.add(id));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...seenPaidOffRef.current])); } catch {}
      return;
    }
    const fresh: string[] = [];
    paidOffNow.forEach((id) => { if (!seenPaidOffRef.current!.has(id)) fresh.push(id); });
    if (fresh.length) {
      fresh.forEach((id) => {
        const p = properties.find((x) => x.id === id);
        if (!p) return;
        const label = (p as any).nickname || p.property?.suburb || "Your property";
        toast.success(`👑 Bond paid off — ${label} is yours free and clear.`);
        seenPaidOffRef.current!.add(id);
      });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...seenPaidOffRef.current])); } catch {}
    }
  }, [loans, properties, loansByProp]);

  const tenantByProp = new Map<string, any>();
  (tenants ?? []).forEach((t: any) => tenantByProp.set(t.player_property_id, t));

  async function onRenew(tenantId: string) {
    setBusyId(tenantId);
    try {
      await renewTenant({ tenantId });
      toast.success("Lease renewed");
      qc.invalidateQueries({ queryKey: ["tenants", user?.id] });
      qc.invalidateQueries({ queryKey: ["player_properties", user?.id] });
    } finally { setBusyId(null); }
  }

  async function onRelease(tenantId: string) {
    setBusyId(tenantId);
    try {
      await releaseTenant(tenantId);
      toast("Tenant will leave at month-end");
      qc.invalidateQueries({ queryKey: ["tenants", user?.id] });
    } finally { setBusyId(null); }
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading portfolio…</div>;

  if (!properties?.length) {
    return (
      <div className="p-6 max-w-3xl mx-auto w-full overflow-y-auto">
        <h1 className="text-2xl font-bold mb-1">Portfolio</h1>
        <p className="text-sm text-muted-foreground mb-6">You don't own any properties yet.</p>
        <div className="rounded-2xl bg-gradient-card border border-border p-8 text-center shadow-card">
          <Building2 className="w-10 h-10 mx-auto text-primary mb-3" />
          <div className="font-semibold mb-1">Buy your first property</div>
          <p className="text-sm text-muted-foreground mb-4">Browse the map or market to find your first investment.</p>
          <Link to="/" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-gold text-primary-foreground font-semibold shadow-gold text-sm">
            Open the map <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto w-full overflow-y-auto pb-8">
      <h1 className="text-2xl font-bold mb-4">Portfolio <span className="text-muted-foreground text-base font-normal">({properties.length})</span></h1>
      <div className="mb-4">
        <QuickActions />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((p) => {
          const tenant = tenantByProp.get(p.id);
          const applicants = applicantCounts?.[p.id] ?? 0;
          const meta = tenant ? rentMetaFor(tenant.renter_type_key) : null;
          const TenantIcon = meta?.icon;
          const isRented = p.status === "rented" && !!tenant;
          const isPaused = p.status === "evicting" || p.status === "selling";
          const actualRent = isRented ? Number(tenant.monthly_rent) : 0;
          const estRent = Number(p.monthly_rent);
          const maint = Number(p.monthly_maintenance);
          const cashflow = isPaused ? 0 : actualRent - maint;
          const hist = history?.[p.id] ?? [];
          const todayValue = Number(p.current_value);
          const yesterdayValue = hist.length >= 2 ? hist[hist.length - 2].value : hist[0]?.value ?? todayValue;
          const todayPct = yesterdayValue > 0 ? ((todayValue - yesterdayValue) / yesterdayValue) * 100 : 0;
          const sparkValues = hist.length >= 2 ? hist.map((h) => h.value) : [];
          const condition = Number((p as any).condition_score ?? 100);
          const nickname = (p as any).nickname as string | null | undefined;
          const li = loansByProp[p.id];
          const paidOff = li?.hasAny && !li.active;
          return (
            <div key={p.id} className="rounded-2xl bg-gradient-card border border-border overflow-hidden shadow-card">
              <div className="aspect-[16/9] bg-muted relative">
                <PropertyImage propertyId={p.property?.id ?? p.property_id} listingPrice={p.property?.listing_price ?? p.purchase_price} imageUrl={(p.property as any)?.image_url} alt={p.property?.address} />
                <StatusPill status={p.status} applicants={applicants} />
                {paidOff && (
                  <div title="Bond paid off — owned outright" className="absolute top-2 left-2 w-9 h-9 rounded-full bg-gradient-gold grid place-items-center shadow-gold border border-amber-200/60 animate-pulse">
                    <Crown className="w-5 h-5 text-amber-900" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2.5">
                <div>
                  <div className="text-sm font-semibold leading-tight truncate">
                    {nickname || p.property?.address}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {nickname ? `${p.property?.suburb} · ${p.property?.address}` : p.property?.suburb}
                  </div>
                </div>
                <ConditionBar value={condition} />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.property?.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.property?.bathrooms}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <Sparkline values={sparkValues} width={56} height={18} />
                    <span className="font-semibold text-foreground tabular-nums">{formatZAR(todayValue, { compact: true })}</span>
                    <PriceChangeChip pct={todayPct} />
                  </span>
                </div>

                {tenant && TenantIcon && (
                  <div className={`flex items-center gap-2 rounded-lg border ${meta!.accent} bg-background/40 p-2`}>
                    <div className={`w-7 h-7 rounded-md grid place-items-center ${meta!.chipBg}`}>
                      <TenantIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{tenant.renter_type?.display_name ?? "Tenant"}</div>
                      <div className="text-[10px] text-muted-foreground">until {String(tenant.lease_end).slice(0, 10)}</div>
                    </div>
                    <HappinessChip value={Number(tenant.happiness ?? 80)} />
                  </div>
                )}

                <div className="flex justify-between items-end pt-1 border-t border-border">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Cashflow</div>
                    {isPaused ? (
                      <div className="text-sm font-bold tabular-nums text-muted-foreground">—</div>
                    ) : (
                      <div className={"text-sm font-bold tabular-nums " + (cashflow >= 0 ? "text-success" : "text-destructive")}>
                        {(cashflow >= 0 ? "+" : "−")}{formatZAR(Math.abs(cashflow))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={"text-[10px] uppercase tracking-wide " + (isRented ? "text-muted-foreground" : "text-muted-foreground/70")}>
                      {isPaused ? "Rent" : isRented ? "Rent" : "Est. rent"}
                    </div>
                    {isPaused ? (
                      <div className="text-sm font-semibold tabular-nums text-muted-foreground">—</div>
                    ) : (
                      <div className={"text-sm font-semibold tabular-nums " + (isRented ? "" : "text-muted-foreground/70 italic")}>
                        {formatZAR(isRented ? actualRent : estRent)}
                      </div>
                    )}
                  </div>
                </div>

                <PropertyActions
                  property={p}
                  tenant={tenant}
                  applicants={applicants}
                  busy={busyId === tenant?.id || busyId === p.id}
                  condition={condition}
                  onFindTenant={() => setApplicantsFor(p)}
                  onRenew={() => tenant && onRenew(tenant.id)}
                  onRelease={() => tenant && onRelease(tenant.id)}
                  onSell={() => setSellingFor(p)}
                  onRenovate={async () => {
                    if (!user) return;
                    setBusyId(p.id);
                    try {
                      const res = await renovateProperty({ userId: user.id, playerPropertyId: p.id });
                      toast.success(`Renovated · −${formatZAR(res.cost)} · condition ${res.newCondition}`);
                      qc.invalidateQueries({ queryKey: ["player_properties", user.id] });
                      qc.invalidateQueries({ queryKey: ["profile", user.id] });
                      qc.invalidateQueries({ queryKey: ["ledger", user.id] });
                    } catch (e: any) {
                      toast.error(e.message ?? "Renovation failed");
                    } finally { setBusyId(null); }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <CityCollection
        open={collectionOpen}
        onToggle={() => setCollectionOpen(!collectionOpen)}
        properties={properties}
        cities={cities ?? []}
        market={market ?? []}
      />

      {applicantsFor && user && (
        <TenantApplicantsSheet
          userId={user.id}
          playerPropertyId={applicantsFor.id}
          suburb={applicantsFor.property?.suburb}
          onClose={() => {
            setApplicantsFor(null);
            qc.invalidateQueries({ queryKey: ["applicants_count", user.id] });
          }}
        />
      )}
      {sellingFor && user && (
        <SellPropertyDialog
          userId={user.id}
          property={sellingFor}
          onClose={() => setSellingFor(null)}
        />
      )}
    </div>
  );
}

function ConditionBar({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-success" : value >= 50 ? "bg-amber-400" : "bg-destructive";
  const label = value >= 80 ? "Excellent" : value >= 50 ? "Worn" : "Poor";
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        <span>Condition · {label}</span>
        <span className="tabular-nums">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={"h-full " + tone} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function CityCollection({
  open, onToggle, properties, cities, market,
}: {
  open: boolean; onToggle: () => void;
  properties: PlayerProperty[];
  cities: any[];
  market: any[];
}) {
  // Owned counts per city per tier (tier 4 = Prestige, tier 5 = Trophy)
  const stats = useMemo(() => {
    const byCity: Record<string, { name: string; ownedTrophy: number; ownedPrestige: number; totalTrophy: number; totalPrestige: number }> = {};
    cities.forEach((c) => {
      byCity[c.id] = { name: c.name, ownedTrophy: 0, ownedPrestige: 0, totalTrophy: 0, totalPrestige: 0 };
    });
    properties.forEach((p) => {
      const cityId = (p.property as any)?.city_id;
      if (!cityId || !byCity[cityId]) return;
      const tier = tierForPrice(Number(p.purchase_price)).id;
      if (tier === 5) byCity[cityId].ownedTrophy += 1;
      if (tier === 4) byCity[cityId].ownedPrestige += 1;
    });
    market.forEach((m) => {
      if (!byCity[m.city_id]) return;
      const tier = tierForPrice(Number(m.listing_price)).id;
      if (tier === 5) byCity[m.city_id].totalTrophy += 1;
      if (tier === 4) byCity[m.city_id].totalPrestige += 1;
    });
    // Add owned back into total available so the denominator includes "yours"
    properties.forEach((p) => {
      const cityId = (p.property as any)?.city_id;
      if (!cityId || !byCity[cityId]) return;
      const tier = tierForPrice(Number(p.purchase_price)).id;
      if (tier === 5) byCity[cityId].totalTrophy += 1;
      if (tier === 4) byCity[cityId].totalPrestige += 1;
    });
    return Object.values(byCity);
  }, [properties, cities, market]);

  return (
    <div className="mt-6 rounded-2xl bg-card border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">City collection — Trophy & Prestige</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="border-t border-border p-3 space-y-2">
          {stats.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-sm">
              <div className="font-medium">{s.name}</div>
              <div className="flex gap-3 text-xs tabular-nums">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  Trophy {s.ownedTrophy}/{s.totalTrophy}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
                  Prestige {s.ownedPrestige}/{s.totalPrestige}
                </span>
              </div>
            </div>
          ))}
          {!stats.length && <div className="text-xs text-muted-foreground">No city data.</div>}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, applicants }: { status: string; applicants: number }) {
  const map: Record<string, string> = {
    vacant: "bg-amber-500/30 text-amber-100 border-amber-400/50",
    rented: "bg-emerald-500/30 text-emerald-100 border-emerald-400/50",
    evicting: "bg-red-500/30 text-red-100 border-red-400/50",
    selling: "bg-sky-500/30 text-sky-100 border-sky-400/50",
  };
  const cls = map[status] ?? "bg-background/85 text-foreground border-border";
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5">
      {status === "vacant" && applicants > 0 && (
        <div className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-gold animate-pulse">
          <UserPlus className="w-3 h-3" /> {applicants} applicant{applicants > 1 ? "s" : ""}
        </div>
      )}
      <div className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide backdrop-blur ${cls}`}>
        {status}
      </div>
    </div>
  );
}

function HappinessChip({ value }: { value: number }) {
  const cls =
    value >= 70
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
      : value >= 40
      ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
      : "bg-red-500/20 text-red-200 border-red-400/40";
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${cls}`}>
      <Heart className="w-3 h-3" />
      {value}
    </div>
  );
}

function PriceChangeChip({ pct }: { pct: number }) {
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0 && !flat;
  const cls = flat
    ? "bg-muted/40 text-muted-foreground border-border"
    : up
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
    : "bg-red-500/20 text-red-300 border-red-400/40";
  const Icon = flat ? TrendingUp : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-bold tabular-nums ${cls}`}>
      <Icon className="w-3 h-3" />
      {(pct >= 0 ? "+" : "") + pct.toFixed(2)}%
    </span>
  );
}

function PropertyActions({
  property,
  tenant,
  applicants,
  busy,
  condition,
  onFindTenant,
  onRenew,
  onRelease,
  onSell,
  onRenovate,
}: {
  property: PlayerProperty;
  tenant: any;
  applicants: number;
  busy: boolean;
  condition: number;
  onFindTenant: () => void;
  onRenew: () => void;
  onRelease: () => void;
  onSell: () => void;
  onRenovate: () => void;
}) {
  const isVacant = property.status === "vacant";
  const isSelling = property.status === "selling";
  const isEvicting = property.status === "evicting";

  if (isSelling) {
    return (
      <div className="text-[11px] text-sky-300 flex items-center gap-1.5 pt-1">
        <Tag className="w-3 h-3" /> Listed for sale — finalising soon
      </div>
    );
  }
  if (isEvicting) {
    return (
      <div className="text-[11px] text-red-300 flex items-center gap-1.5 pt-1">
        <DoorOpen className="w-3 h-3" /> Eviction in progress
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 pt-1">
      {isVacant ? (
        <Button
          size="sm"
          onClick={onFindTenant}
          className="h-9 text-xs bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          {applicants > 0 ? `Pick from ${applicants}` : "Find tenant"}
        </Button>
      ) : tenant ? (
        <>
          <Button size="sm" variant="outline" onClick={onRenew} disabled={busy} className="h-9 text-xs">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Renew
          </Button>
          <Button size="sm" variant="outline" onClick={onRelease} disabled={busy} className="h-9 text-xs">
            <Users className="w-3.5 h-3.5" /> Release
          </Button>
        </>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={onSell}
        className={"h-9 text-xs " + (isVacant ? "" : "col-span-2")}
      >
        <Tag className="w-3.5 h-3.5" /> Sell
      </Button>
      {condition < 100 && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRenovate}
          disabled={busy}
          className="h-9 text-xs col-span-2 border-primary/40 text-primary hover:bg-primary/10"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
          Renovate (+20 condition · 1% of value)
        </Button>
      )}
    </div>
  );
}
