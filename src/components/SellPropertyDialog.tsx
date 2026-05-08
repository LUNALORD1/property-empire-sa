import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { sellProperty } from "@/lib/tenants";
import type { PlayerProperty } from "@/lib/game";
import { X, AlertTriangle, Banknote, TrendingDown, Users } from "lucide-react";
import { toast } from "sonner";

export function SellPropertyDialog({
  userId,
  property,
  onClose,
}: {
  userId: string;
  property: PlayerProperty;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [bond, setBond] = useState(0);
  const [loadingBond, setLoadingBond] = useState(true);
  const [busy, setBusy] = useState(false);

  const value = Number(property.current_value);
  const commission = Math.round(value * 0.05);
  const net = value - commission - bond;
  const isRented = property.status === "rented";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("loans")
        .select("balance")
        .eq("player_property_id", property.id)
        .eq("active", true);
      if (cancelled) return;
      const total = (data ?? []).reduce((s, l) => s + Number(l.balance), 0);
      setBond(total);
      setLoadingBond(false);
    })();
    return () => { cancelled = true; };
  }, [property.id]);

  async function onConfirm() {
    if (busy || loadingBond) return;
    setBusy(true);
    try {
      const res = await sellProperty({ userId, playerPropertyId: property.id });
      if (res.pending) {
        toast.success("Listed for sale", {
          description: "Your tenant gets one month notice — sale finalises tomorrow.",
        });
      } else {
        toast.success("Sold", {
          description: `${formatZAR(res.net)} cleared into your account.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["player_properties", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["loans", userId] });
      qc.invalidateQueries({ queryKey: ["ledger", userId] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Sale failed");
      setBusy(false);
    }
  }

  const underwater = !loadingBond && net < 0;

  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-card overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between p-4 border-b border-border">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sell property</div>
              <h2 className="text-lg font-bold leading-tight">{property.property?.suburb}</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[20rem]">{property.property?.address}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/60 grid place-items-center hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="p-4 space-y-3">
            <Row label="Sale price (current value)" value={formatZAR(value)} />
            <Row label="Agent commission (5%)" value={"− " + formatZAR(commission)} negative icon={<TrendingDown className="w-3.5 h-3.5" />} />
            <Row label="Bond settlement" value={"− " + formatZAR(bond)} negative icon={<Banknote className="w-3.5 h-3.5" />} loading={loadingBond} />
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Net cash to you</div>
              <div className={"text-2xl font-bold tabular-nums " + (underwater ? "text-destructive" : "text-gradient-gold")}>
                {underwater ? "−" : ""}{formatZAR(Math.abs(net))}
              </div>
            </div>

            {underwater && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Underwater</div>
                  <div>Your bond balance exceeds the sale price. Pay down the loan or wait for the property to appreciate.</div>
                </div>
              </div>
            )}

            {isRented && !underwater && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs flex gap-2">
                <Users className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  Your tenant gets <strong>one month notice</strong>. The sale finalises after the notice ends.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="h-11">Cancel</Button>
              <Button
                onClick={onConfirm}
                disabled={busy || loadingBond || underwater}
                className="h-11 bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"
              >
                {isRented ? "List for sale" : "Confirm sale"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Row({
  label,
  value,
  negative,
  icon,
  loading,
}: {
  label: string;
  value: string;
  negative?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className={"font-semibold tabular-nums " + (negative ? "text-destructive" : "")}>
        {loading ? "…" : value}
      </div>
    </div>
  );
}