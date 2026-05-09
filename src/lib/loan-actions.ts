import { supabase } from "@/integrations/supabase/client";
import { computeMonthlyPayment, originationRate } from "@/lib/game";

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Partial early repayment. Reduces balance, recalculates monthly payment over remaining term. */
export async function partialRepayLoan(opts: {
  userId: string;
  loan: any;
  amount: number;
  cash: number;
  nickname?: string | null;
}) {
  const { userId, loan, amount, cash, nickname } = opts;
  const balance = Number(loan.balance);
  if (amount < 1000) throw new Error("Minimum R1,000");
  if (amount > cash) throw new Error("Insufficient cash");
  if (amount >= balance) throw new Error("Use 'Pay off in full' for full settlement");

  const newBalance = balance - amount;
  // Estimate remaining term: use existing payment & rate to derive months left.
  const r = Number(loan.interest_rate) / 100 / 12;
  let remainingMonths = Number(loan.term_months) || 240;
  if (r > 0 && Number(loan.monthly_payment) > 0) {
    const ratio = Number(loan.monthly_payment) / (balance * r);
    if (ratio > 1.0001) {
      remainingMonths = Math.max(1, Math.round(Math.log(ratio / (ratio - 1)) / Math.log(1 + r)));
    }
  }
  const newPayment = computeMonthlyPayment(newBalance, Number(loan.interest_rate), remainingMonths);
  const yyyymm = new Date().toISOString().slice(0, 7);

  await supabase.from("loans").update({
    balance: newBalance,
    monthly_payment: newPayment,
    last_partial_repayment_month: yyyymm,
  } as any).eq("id", loan.id);

  await supabase.from("profiles").update({ cash: cash - amount }).eq("id", userId);
  await supabase.from("ledger").insert({
    player_id: userId,
    type: "loan_partial",
    amount: -amount,
    description: `Partial loan repayment — ${nickname ?? "bond"}`,
  });
}

/** Pay off the entire outstanding loan. */
export async function payoffLoanFull(opts: {
  userId: string;
  loan: any;
  cash: number;
  nickname?: string | null;
}) {
  const { userId, loan, cash, nickname } = opts;
  const balance = Number(loan.balance);
  if (cash < balance) throw new Error("Insufficient cash");
  await supabase.from("loans").update({ balance: 0, active: false } as any).eq("id", loan.id);
  await supabase.from("profiles").update({ cash: cash - balance }).eq("id", userId);
  await supabase.from("ledger").insert({
    player_id: userId,
    type: "loan_payoff",
    amount: -balance,
    description: `Full loan payoff — ${nickname ?? "bond"}`,
  });
}

/** Take a payment holiday — skips next tick repayment, capitalises interest. */
export async function takePaymentHoliday(opts: { loan: any }) {
  const { loan } = opts;
  const today = new Date().toISOString().slice(0, 10);
  if (loan.payment_holiday_last_used_at) {
    const last = loan.payment_holiday_last_used_at as string;
    if (monthsBetween(last, today) < 12) {
      throw new Error("Already used this year");
    }
  }
  await supabase.from("loans").update({
    payment_holiday_last_used_at: today,
    holiday_active: true,
  } as any).eq("id", loan.id);
}

/** Refinance a loan against current property value. Returns cash released. */
export async function refinanceLoan(opts: {
  userId: string;
  loan: any;
  currentValue: number;
  ltv: number;
  termMonths: number;
  ownedCount: number;
  cash: number;
  nickname?: string | null;
}) {
  const { userId, loan, currentValue, ltv, termMonths, ownedCount, cash, nickname } = opts;
  const today = new Date().toISOString().slice(0, 10);
  if (loan.refinanced_at && monthsBetween(loan.refinanced_at, today) < 24) {
    throw new Error("Already refinanced in the last 24 months");
  }
  const newPrincipal = Math.round(currentValue * (ltv / 100));
  const oldBalance = Number(loan.balance);
  if (newPrincipal <= oldBalance) throw new Error("New loan amount does not release equity");
  const newRate = originationRate(ltv, ownedCount);
  const newPayment = computeMonthlyPayment(newPrincipal, newRate, termMonths);
  const released = newPrincipal - oldBalance;

  await supabase.from("loans").update({
    principal: newPrincipal,
    balance: newPrincipal,
    interest_rate: newRate,
    origination_rate: newRate,
    term_months: termMonths,
    monthly_payment: newPayment,
    ltv,
    refinanced_at: today,
    overpayment_streak: 0,
    rate_reduction_applied: 0,
    last_partial_repayment_month: null,
  } as any).eq("id", loan.id);

  await supabase.from("profiles").update({ cash: cash + released }).eq("id", userId);
  await supabase.from("ledger").insert({
    player_id: userId,
    type: "refinance",
    amount: released,
    description: `Refinance — ${nickname ?? "bond"} — ${formatCurrency(released)} equity released`,
  });

  return released;
}

function formatCurrency(n: number) {
  return "R" + Math.round(n).toLocaleString("en-ZA");
}