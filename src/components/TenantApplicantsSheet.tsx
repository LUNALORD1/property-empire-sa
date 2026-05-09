import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { acceptApplicant, declineApplicant, postTenantAd, AD_COST, type RenterType, type TenantApplicant } from "@/lib/tenants";
import { RENTER_META, DAMAGE_RISK_META, rentMetaFor } from "@/lib/renter-meta";
import {
  X,
  Check,
  Star,
  ShieldAlert,
  Calendar,
  Banknote,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Loader2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";

type Row = TenantApplicant & { renter_type: RenterType };

export function TenantApplicantsSheet({
  userId,
  playerPropertyId,
  suburb,
  onClose,
}: {
  userId: string;
  playerPropertyId: string;
  suburb?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tenant_applicants", playerPropertyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_applicants")
        .select("*, renter_type:renter_type_key(*)")
        .eq("player_property_id", playerPropertyId);
      if (error) throw error;
      return data as Row[];
    },
  });

  // Read property meta to know if an ad was already posted this month + cash
  const { data: ppMeta, refetch: refetchMeta } = useQuery({
    queryKey: ["pp_ad_meta", playerPropertyId, userId],
    queryFn: async () => {
      const [{ data: pp }, { data: prof }] = await Promise.all([
        supabase.from("player_properties").select("last_ad_posted_at").eq("id", playerPropertyId).single(),
        supabase.from("profiles").select("cash").eq("id", userId).single(),
      ]);
      return { last: (pp as any)?.last_ad_posted_at as string | null, cash: Number(prof?.cash ?? 0) };
    },
  });

  const adPostedRecently = (() => {
    const last = ppMeta?.last;
    if (!last) return false;
    const diff = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    return diff < 30;
  })();
  const canAfford = (ppMeta?.cash ?? 0) >= AD_COST;
  const [postingAd, setPostingAd] = useState(false);

  async function onPostAd() {
    if (postingAd) return;
    setPostingAd(true);
    try {
      await postTenantAd({ userId, playerPropertyId });
      toast.success("Ad posted", { description: `R${AD_COST.toLocaleString()} spent · 1 new applicant` });
      await Promise.all([refetch(), refetchMeta()]);
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not post ad");
    } finally {
      setPostingAd(false);
    }
  }

  const applicants = useMemo(() => (data ?? []).filter((a) => a.renter_type), [data]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = applicants[index];

  // Keep index in range as applicants drop
  useEffect(() => {
    if (index >= applicants.length && applicants.length > 0) setIndex(applicants.length - 1);
  }, [applicants.length, index]);

  async function onAccept() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await acceptApplicant({ userId, applicantId: current.id });
      toast.success(`${current.renter_type.display_name} signed the lease`, {
        description: `${formatZAR(Number(current.offered_rent))}/mo · ${current.renter_type.lease_months}-month lease`,
      });
      qc.invalidateQueries({ queryKey: ["player_properties", userId] });
      qc.invalidateQueries({ queryKey: ["tenants", userId] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept tenant");
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await declineApplicant(current.id);
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-3xl bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-card overflow-hidden max-h-[92vh] flex flex-col animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 p-4 border-b border-border">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                <UserPlus className="w-3 h-3" /> Tenant applicants
              </div>
              <h2 className="text-lg font-bold leading-tight mt-0.5">{suburb ?? "Vacant property"}</h2>
              <p className="text-xs text-muted-foreground">
                {applicants.length
                  ? `${applicants.length} interested ${applicants.length === 1 ? "renter" : "renters"} — pick one to sign a lease.`
                  : "No one is biting right now."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/60 grid place-items-center hover:bg-muted"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="px-4 pt-3">
            <Button
              variant="outline"
              disabled={postingAd || adPostedRecently || !canAfford}
              onClick={onPostAd}
              className="w-full h-10"
            >
              <Megaphone className="w-4 h-4" />
              {adPostedRecently
                ? "Ad already posted"
                : !canAfford
                ? "Insufficient funds"
                : postingAd
                ? "Posting…"
                : `Post an Ad — R${AD_COST.toLocaleString()}`}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="py-16 grid place-items-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : applicants.length === 0 ? (
              <EmptyApplicants />
            ) : (
              <>
                {/* Mobile: swipeable single card */}
                <div className="sm:hidden">
                  {current && (
                    <ApplicantCard
                      applicant={current}
                      busy={busy}
                      onAccept={onAccept}
                      onDecline={onDecline}
                    />
                  )}
                  {applicants.length > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => setIndex((i) => Math.max(0, i - 1))}
                        disabled={index === 0}
                        className="w-10 h-10 rounded-full bg-muted/60 grid place-items-center disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="flex gap-1.5">
                        {applicants.map((_, i) => (
                          <div
                            key={i}
                            className={
                              "h-1.5 rounded-full transition-all " +
                              (i === index ? "w-6 bg-primary" : "w-1.5 bg-muted")
                            }
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setIndex((i) => Math.min(applicants.length - 1, i + 1))}
                        disabled={index >= applicants.length - 1}
                        className="w-10 h-10 rounded-full bg-muted/60 grid place-items-center disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {/* Desktop: grid */}
                <div className="hidden sm:grid grid-cols-2 gap-3">
                  {applicants.map((a) => (
                    <ApplicantCard
                      key={a.id}
                      applicant={a}
                      busy={busy}
                      onAccept={async () => {
                        setIndex(applicants.indexOf(a));
                        await onAccept();
                      }}
                      onDecline={async () => {
                        setBusy(true);
                        try { await declineApplicant(a.id); await refetch(); } finally { setBusy(false); }
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function EmptyApplicants() {
  return (
    <div className="py-12 text-center space-y-2">
      <div className="text-3xl">🪧</div>
      <div className="font-semibold">No applicants yet</div>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
        Demand is quiet for this suburb — applicants will appear over the coming days. Try waiting,
        or sell if it stays vacant.
      </p>
    </div>
  );
}

function ApplicantCard({
  applicant,
  busy,
  onAccept,
  onDecline,
}: {
  applicant: Row;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const meta = rentMetaFor(applicant.renter_type_key);
  const Icon = meta.icon;
  const damage = DAMAGE_RISK_META[applicant.renter_type.damage_risk] ?? DAMAGE_RISK_META.medium;
  const reliability = Number(applicant.renter_type.reliability);
  const stars = Math.max(1, Math.min(5, Math.round(reliability / 20)));

  return (
    <div className={`relative rounded-2xl border bg-card overflow-hidden ${meta.accent}`}>
      <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${meta.gradient} pointer-events-none`} />
      <div className="relative p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl grid place-items-center ${meta.chipBg}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-tight">{applicant.renter_type.display_name}</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {applicant.renter_type.flavour ?? meta.tagline}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-background/50 border border-border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Banknote className="w-3 h-3 text-primary" /> Offered rent
          </div>
          <div className="text-2xl font-bold tabular-nums text-gradient-gold leading-tight">
            {formatZAR(Number(applicant.offered_rent))}
            <span className="text-xs font-normal text-muted-foreground"> / mo</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Reliability"
            value={
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      "w-3.5 h-3.5 " +
                      (i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")
                    }
                  />
                ))}
              </div>
            }
            sub={`${reliability}%`}
          />
          <Stat
            label="Damage"
            value={
              <div className={"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold " + damage.cls}>
                <ShieldAlert className="w-3 h-3" /> {damage.label.replace(" risk", "")}
              </div>
            }
          />
          <Stat
            label="Lease"
            value={
              <div className="flex items-center gap-1 text-sm font-bold tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {applicant.renter_type.lease_months} mo
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            disabled={busy}
            onClick={onDecline}
            className="h-11"
          >
            <X className="w-4 h-4" /> Decline
          </Button>
          <Button
            disabled={busy}
            onClick={onAccept}
            className="h-11 bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"
          >
            <Check className="w-4 h-4" /> Sign lease
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-background/40 border border-border p-2 text-center">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex justify-center items-center min-h-6">{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

// Keep RENTER_META referenced so tree-shake doesn't drop it from the bundle when consumers
// haven't imported it directly elsewhere yet.
export const __renterMetaKeys = Object.keys(RENTER_META);