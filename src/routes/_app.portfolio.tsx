import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useApplicantsCount, usePlayerProperties, useTenants } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import {
  Bed, Bath, Building2, TrendingUp, ArrowRight, UserPlus, Users,
  Heart, Tag, RefreshCw, DoorOpen, Loader2,
} from "lucide-react";
import { QuickActions } from "@/components/QuickActions";
import { useState } from "react";
import { TenantApplicantsSheet } from "@/components/TenantApplicantsSheet";
import { SellPropertyDialog } from "@/components/SellPropertyDialog";
import { PropertyImage } from "@/components/PropertyImage";
import { rentMetaFor } from "@/lib/renter-meta";
import { Button } from "@/components/ui/button";
import { renewTenant, releaseTenant } from "@/lib/tenants";
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
  const qc = useQueryClient();
  const [applicantsFor, setApplicantsFor] = useState<PlayerProperty | null>(null);
  const [sellingFor, setSellingFor] = useState<PlayerProperty | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
          const cashflow = Number(p.monthly_rent) - Number(p.monthly_maintenance);
          const tenant = tenantByProp.get(p.id);
          const applicants = applicantCounts?.[p.id] ?? 0;
          const meta = tenant ? rentMetaFor(tenant.renter_type_key) : null;
          const TenantIcon = meta?.icon;
          return (
            <div key={p.id} className="rounded-2xl bg-gradient-card border border-border overflow-hidden shadow-card">
              <div className="aspect-[16/9] bg-muted relative">
                <PropertyImage propertyId={p.property?.id ?? p.property_id} listingPrice={p.property?.listing_price ?? p.purchase_price} alt={p.property?.address} />
                <StatusPill status={p.status} applicants={applicants} />
              </div>
              <div className="p-3 space-y-2.5">
                <div>
                  <div className="text-sm font-semibold leading-tight">{p.property?.suburb}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.property?.address}</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.property?.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.property?.bathrooms}</span>
                  <span className="ml-auto flex items-center gap-1 text-success"><TrendingUp className="w-3 h-3" />{formatZAR(Number(p.current_value), { compact: true })}</span>
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
                    <div className={"text-sm font-bold tabular-nums " + (cashflow >= 0 ? "text-success" : "text-destructive")}>
                      {(cashflow >= 0 ? "+" : "−")}{formatZAR(Math.abs(cashflow))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Rent</div>
                    <div className="text-sm font-semibold tabular-nums">{formatZAR(Number(p.monthly_rent))}</div>
                  </div>
                </div>

                <PropertyActions
                  property={p}
                  tenant={tenant}
                  applicants={applicants}
                  busy={busyId === tenant?.id || busyId === p.id}
                  onFindTenant={() => setApplicantsFor(p)}
                  onRenew={() => tenant && onRenew(tenant.id)}
                  onRelease={() => tenant && onRelease(tenant.id)}
                  onSell={() => setSellingFor(p)}
                />
              </div>
            </div>
          );
        })}
      </div>

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

function PropertyActions({
  property,
  tenant,
  applicants,
  busy,
  onFindTenant,
  onRenew,
  onRelease,
  onSell,
}: {
  property: PlayerProperty;
  tenant: any;
  applicants: number;
  busy: boolean;
  onFindTenant: () => void;
  onRenew: () => void;
  onRelease: () => void;
  onSell: () => void;
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
    </div>
  );
}
