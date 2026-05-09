import { useMemo, useState } from "react";
import { Banknote, Shield, Flame, Calendar, Crown, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/format";
import { computeMonthlyPayment, originationRate, ltvBaseRate, preferredDiscount } from "@/lib/game";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { partialRepayLoan, payoffLoanFull, takePaymentHoliday, refinanceLoan } from "@/lib/loan-actions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Modal = null | "extra" | "payoff" | "holiday" | "refi";

export function LoanCard({
  userId, loan, pp, cash, ownedCount, rateMod, monthsLeft,
}: {
  userId: string;
  loan: any;
  pp: any | undefined;
  cash: number;
  ownedCount: number;
  rateMod: number;
  monthsLeft: number;
}) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);

  const balance = Number(loan.balance);
  const principal = Number(loan.principal);
  const paidPct = ((principal - balance) / principal) * 100;
  const baseRate = Number(loan.interest_rate);
  const origRate = Number(loan.origination_rate ?? loan.interest_rate);
  const effectiveRate = baseRate + rateMod;
  const nickname = pp?.nickname || pp?.property?.suburb || "Bond";
  const currentValue = Number(pp?.current_value ?? 0);
  const purchasePrice = Number(pp?.purchase_price ?? 0);
  const refiUnlocked = currentValue > 0 && purchasePrice > 0 && currentValue >= purchasePrice * 1.15;
  const reduction = Number(loan.rate_reduction_applied ?? 0);
  const streak = Number(loan.overpayment_streak ?? 0);

  const today = new Date();
  const holidayUsedRecently = loan.payment_holiday_last_used_at
    ? (() => {
        const last = new Date(loan.payment_holiday_last_used_at);
        const months = (today.getFullYear() - last.getFullYear()) * 12 + (today.getMonth() - last.getMonth());
        return months < 12;
      })()
    : false;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["loans", userId] });
    qc.invalidateQueries({ queryKey: ["profile", userId] });
    qc.invalidateQueries({ queryKey: ["ledger", userId] });
    qc.invalidateQueries({ queryKey: ["player_properties", userId] });
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-medium truncate pr-2 flex items-center gap-1.5">
          <span className="truncate">{nickname}</span>
          <span className="text-xs text-muted-foreground">· {loan.ltv}% LTV</span>
          {loan.insurance_active && <Shield className="w-3 h-3 text-primary shrink-0" aria-label="Insured" />}
          {loan.holiday_active && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">Holiday</span>
          )}
          {streak >= 1 && (
            <span className="text-[10px] flex items-center gap-0.5 text-amber-300">
              <Flame className="w-3 h-3" />{streak}
            </span>
          )}
        </div>
        <div className="text-sm font-bold tabular-nums">{formatZAR(balance, { compact: true })}</div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-gold" style={{ width: `${Math.min(100, Math.max(0, paidPct))}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>{formatZAR(Number(loan.monthly_payment))}/mo · {Math.round(Number(loan.term_months) / 12)} yr</span>
        <span>{paidPct.toFixed(1)}% paid off</span>
      </div>
      <div className="flex justify-between text-[10px] mt-1">
        <span className="text-muted-foreground">
          Origination <span className="font-semibold tabular-nums text-foreground">{origRate.toFixed(2)}%</span>
          {reduction > 0 && <span className="text-amber-300 ml-1">(−{reduction.toFixed(2)} loyalty)</span>}
          {" · Effective "}
          <span className={"font-semibold tabular-nums " + (rateMod > 0 ? "text-destructive" : rateMod < 0 ? "text-success" : "text-foreground")}>{effectiveRate.toFixed(2)}%</span>
          {rateMod !== 0 && <span className="ml-1 text-accent">({rateMod >= 0 ? "+" : ""}{rateMod.toFixed(2)} SARB · {monthsLeft}mo)</span>}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setModal("extra")}>
          <Banknote className="w-3 h-3" /> Pay extra
        </Button>
        <Button
          size="sm" variant="outline" className="h-8 text-[11px]"
          disabled={cash < balance}
          title={cash < balance ? "Insufficient funds" : undefined}
          onClick={() => setModal("payoff")}
        >
          <Crown className="w-3 h-3" /> Pay off in full
        </Button>
        <Button
          size="sm" variant="outline" className="h-8 text-[11px]"
          disabled={holidayUsedRecently || loan.holiday_active}
          title={holidayUsedRecently ? "Used this year" : undefined}
          onClick={() => setModal("holiday")}
        >
          <Calendar className="w-3 h-3" /> Payment holiday
        </Button>
        <Button
          size="sm" variant="outline" className="h-8 text-[11px]"
          disabled={!refiUnlocked}
          title={!refiUnlocked ? "Unlocks at +15% appreciation" : undefined}
          onClick={() => setModal("refi")}
        >
          <RefreshCw className="w-3 h-3" /> Refinance
        </Button>
      </div>

      {modal === "extra" && (
        <ExtraModal
          balance={balance} cash={cash}
          onClose={() => setModal(null)}
          onConfirm={async (amt) => {
            try {
              setBusy(true);
              await partialRepayLoan({ userId, loan, amount: amt, cash, nickname });
              toast.success(`R${amt.toLocaleString("en-ZA")} extra paid towards ${nickname}`);
              setModal(null); refresh();
            } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }}
          busy={busy}
        />
      )}
      {modal === "payoff" && (
        <ConfirmModal
          title="Pay off bond in full"
          body={
            <>
              <p>This will clear the entire outstanding balance of <strong>{formatZAR(balance)}</strong>.</p>
              <p className="mt-2 text-xs text-muted-foreground">Cash after payment: <strong className="text-foreground">{formatZAR(cash - balance)}</strong></p>
            </>
          }
          confirmLabel="Pay off bond"
          onClose={() => setModal(null)}
          busy={busy}
          onConfirm={async () => {
            try {
              setBusy(true);
              await payoffLoanFull({ userId, loan, cash, nickname });
              toast.success(`Bond paid off — ${nickname} is yours free and clear.`);
              setModal(null); refresh();
            } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }}
        />
      )}
      {modal === "holiday" && (
        <ConfirmModal
          title="Take a payment holiday"
          body={
            <>
              <p>Skip next month's repayment of <strong>{formatZAR(Number(loan.monthly_payment))}</strong>.</p>
              <p className="mt-2 text-xs text-muted-foreground">Interest will still accrue and be added to the outstanding balance. Limit one holiday per loan per 12 months.</p>
            </>
          }
          confirmLabel="Take holiday"
          onClose={() => setModal(null)}
          busy={busy}
          onConfirm={async () => {
            try {
              setBusy(true);
              await takePaymentHoliday({ loan });
              toast.success(`Payment holiday booked — interest will capitalise on next tick.`);
              setModal(null); refresh();
            } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }}
        />
      )}
      {modal === "refi" && (
        <RefiModal
          loan={loan} currentValue={currentValue} ownedCount={ownedCount}
          nickname={nickname} cash={cash} userId={userId}
          onClose={() => setModal(null)}
          onDone={(released) => {
            toast.success(`Refinance complete — ${formatZAR(released)} equity released.`);
            setModal(null); refresh();
          }}
        />
      )}
    </div>
  );
}

function ExtraModal({ balance, cash, onClose, onConfirm, busy }: {
  balance: number; cash: number; onClose: () => void; busy: boolean;
  onConfirm: (amount: number) => void;
}) {
  const [val, setVal] = useState("");
  const amt = Math.floor(Number(val.replace(/[^0-9]/g, "")) || 0);
  const max = Math.min(cash, balance - 1);
  const valid = amt >= 1000 && amt <= max;
  return (
    <ModalShell title="Make a partial repayment" onClose={onClose}>
      <div className="text-xs text-muted-foreground mb-3">
        Outstanding balance: <strong className="text-foreground">{formatZAR(balance)}</strong> · Cash on hand: <strong className="text-foreground">{formatZAR(cash)}</strong>
      </div>
      <input
        autoFocus
        type="text" inputMode="numeric"
        placeholder="Amount (min R1,000)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-base tabular-nums"
      />
      <div className="text-[11px] text-muted-foreground mt-1.5">Max: {formatZAR(max)}</div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!valid || busy} onClick={() => onConfirm(amt)}
          className="bg-gradient-gold text-primary-foreground font-semibold">Pay {amt > 0 ? formatZAR(amt) : "extra"}</Button>
      </div>
    </ModalShell>
  );
}

function RefiModal({ loan, currentValue, ownedCount, nickname, cash, userId, onClose, onDone }: {
  loan: any; currentValue: number; ownedCount: number; nickname: string;
  cash: number; userId: string;
  onClose: () => void; onDone: (released: number) => void;
}) {
  const [ltv, setLtv] = useState<number>(85);
  const [termYears, setTermYears] = useState<10 | 15 | 20>(20);
  const [busy, setBusy] = useState(false);
  const newRate = useMemo(() => originationRate(ltv, ownedCount), [ltv, ownedCount]);
  const newPrincipal = Math.round(currentValue * (ltv / 100));
  const newPayment = computeMonthlyPayment(newPrincipal, newRate, termYears * 12);
  const released = newPrincipal - Number(loan.balance);
  const valid = released > 0;
  return (
    <ModalShell title={`Refinance — ${nickname}`} onClose={onClose}>
      <div className="text-xs text-muted-foreground mb-2">Current property value: <strong className="text-foreground">{formatZAR(currentValue)}</strong></div>
      <div className="flex gap-1.5">
        {[50, 70, 85, 90].map((v) => (
          <button key={v} onClick={() => setLtv(v)}
            className={"flex-1 py-1.5 rounded-md text-[11px] font-semibold border " + (ltv === v ? "bg-primary/20 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
            {v}%<div className="text-[9px] opacity-80 font-normal">{ltvBaseRate(v).toFixed(2)}%</div>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {[10, 15, 20].map((y) => (
          <button key={y} onClick={() => setTermYears(y as 10|15|20)}
            className={"flex-1 py-1.5 rounded-md text-[11px] font-semibold border " + (termYears === y ? "bg-primary/20 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>{y} yrs</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] mt-3">
        <Row label="Old balance" value={formatZAR(Number(loan.balance), { compact: true })} />
        <Row label="New loan" value={formatZAR(newPrincipal, { compact: true })} />
        <Row label="Cash released" value={formatZAR(released, { compact: true })} good={released > 0} bad={released <= 0} />
        <Row label="New repay/mo" value={formatZAR(newPayment)} />
      </div>
      <div className="text-[10px] text-amber-300 mt-2">⚠ Payoff progress and loyalty streak reset to zero. Limit one refinance per 24 months.</div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!valid || busy} className="bg-gradient-gold text-primary-foreground font-semibold"
          onClick={async () => {
            try {
              setBusy(true);
              const released2 = await refinanceLoan({
                userId, loan, currentValue, ltv, termMonths: termYears * 12,
                ownedCount, cash, nickname,
              });
              onDone(released2);
            } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }}>
          Refinance
        </Button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, body, confirmLabel, onClose, onConfirm, busy }: {
  title: string; body: React.ReactNode; confirmLabel: string;
  onClose: () => void; onConfirm: () => void; busy: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="text-sm">{body}</div>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={busy} onClick={onConfirm}
          className="bg-gradient-gold text-primary-foreground font-semibold">{confirmLabel}</Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Overlay onClose={onClose}>
      <div className="fixed inset-0 grid place-items-center bg-black/70 backdrop-blur p-4 animate-fade-in" style={{ zIndex: Z.modal }} onClick={onClose}>
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-card p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">{title}</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-background/60 grid place-items-center"><X className="w-3.5 h-3.5" /></button>
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

function Row({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 border border-border p-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-sm font-semibold tabular-nums " + (good ? "text-success" : bad ? "text-destructive" : "")}>{value}</div>
    </div>
  );
}