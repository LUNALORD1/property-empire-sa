import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLedger, useLoans, usePlayerProperties, useProfile } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import { netWorth } from "@/lib/game";
import { TrendingUp, TrendingDown, Wallet, Building2, CreditCard, Sigma, Banknote } from "lucide-react";
import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/finances")({
  head: () => ({
    meta: [
      { title: "Finances — Property Empire SA" },
      { name: "description", content: "Cash, debt, net worth, bonds, and your monthly income vs expenses." },
    ],
  }),
  component: FinancesPage,
});

function FinancesPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: properties } = usePlayerProperties(user?.id);
  const { data: ledger } = useLedger(user?.id);
  const { data: loans } = useLoans(user?.id);

  const cash = Number(profile?.cash ?? 0);
  const portfolio = (properties ?? []).reduce((s, p) => s + Number(p.current_value), 0);
  const activeLoans = (loans ?? []).filter((l) => l.active);
  const debt = activeLoans.reduce((s, l) => s + Number(l.balance), 0);
  const monthlyLoanPayment = activeLoans.reduce((s, l) => s + Number(l.monthly_payment), 0);
  const nw = netWorth(cash, properties ?? [], debt);

  const monthlyIncome = (properties ?? []).filter((p) => p.status === "rented").reduce((s, p) => s + Number(p.monthly_rent), 0);
  const monthlyMaint = (properties ?? []).reduce((s, p) => s + Number(p.monthly_maintenance), 0);
  const monthlyExpense = monthlyMaint + monthlyLoanPayment;

  const propertyById = useMemo(
    () => Object.fromEntries((properties ?? []).map((p) => [p.id, p])),
    [properties],
  );

  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; income: number; expense: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10);
      buckets[key] = { date: key, income: 0, expense: 0 };
    }
    (ledger ?? []).forEach((e: any) => {
      const k = e.created_at.slice(5, 10);
      if (!buckets[k]) return;
      const amt = Number(e.amount);
      if (amt >= 0) buckets[k].income += amt;
      else buckets[k].expense += -amt;
    });
    return Object.values(buckets);
  }, [ledger]);

  return (
    <div className="p-4 max-w-3xl mx-auto w-full overflow-y-auto space-y-5 pb-8">
      <h1 className="text-2xl font-bold">Finances</h1>

      <div className="rounded-2xl p-5 bg-gradient-card border border-primary/20 shadow-gold relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/15 blur-2xl" />
        <div className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1.5"><Sigma className="w-3.5 h-3.5" />Net worth</div>
        <div className="text-4xl font-bold text-gradient-gold tabular-nums mt-1">{formatZAR(nw)}</div>
        <div className="grid grid-cols-3 gap-3 mt-5 relative">
          <Stat icon={<Wallet className="w-3.5 h-3.5" />} label="Cash" value={formatZAR(cash, { compact: cash >= 100000 })} />
          <Stat icon={<Building2 className="w-3.5 h-3.5" />} label="Properties" value={formatZAR(portfolio, { compact: true })} />
          <Stat icon={<CreditCard className="w-3.5 h-3.5" />} label="Debt" value={formatZAR(debt, { compact: debt >= 100000 })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-success" />Monthly income</div>
          <div className="text-xl font-bold text-success tabular-nums mt-1">{formatZAR(monthlyIncome)}</div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-destructive" />Monthly expenses</div>
          <div className="text-xl font-bold text-destructive tabular-nums mt-1">{formatZAR(monthlyExpense)}</div>
          {monthlyLoanPayment > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1">incl. {formatZAR(monthlyLoanPayment)} bonds</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold">Bonds</div>
          {activeLoans.length > 0 && (
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground ml-auto">
              {activeLoans.length} active · prime {activeLoans[0]?.interest_rate}%
            </div>
          )}
        </div>
        {activeLoans.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            You have no outstanding bonds. Once you own at least one property, you can finance future
            purchases with a home loan from the property card.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeLoans.map((l) => {
              const pp = propertyById[l.player_property_id];
              const paidPct = ((Number(l.principal) - Number(l.balance)) / Number(l.principal)) * 100;
              return (
                <div key={l.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-sm font-medium truncate pr-2">
                      {pp?.property?.suburb ?? "Bond"}{" "}
                      <span className="text-xs text-muted-foreground">· {l.ltv}% LTV</span>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{formatZAR(Number(l.balance), { compact: true })}</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-gold" style={{ width: `${Math.min(100, Math.max(0, paidPct))}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>{formatZAR(Number(l.monthly_payment))}/mo · 20 yr</span>
                    <span>{paidPct.toFixed(1)}% paid off</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-sm font-semibold mb-3">Last 14 days · cash flow</div>
        <div className="h-48 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="oklch(0.32 0.04 260)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="oklch(0.72 0.025 250)" tick={{ fontSize: 10 }} />
              <YAxis stroke="oklch(0.72 0.025 250)" tick={{ fontSize: 10 }} tickFormatter={(v) => "R" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.045 260)", border: "1px solid oklch(0.32 0.04 260)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => "R" + Number(v).toLocaleString("en-ZA")} />
              <Line type="monotone" dataKey="income" stroke="oklch(0.72 0.15 155)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" stroke="oklch(0.62 0.22 25)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="text-sm font-semibold mb-2">Recent transactions</div>
        <div className="divide-y divide-border">
          {(ledger ?? []).slice(0, 12).map((e: any) => (
            <div key={e.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium capitalize">{e.type.replace("_", " ")}</div>
                <div className="text-xs text-muted-foreground truncate">{e.description}</div>
              </div>
              <div className={"tabular-nums font-semibold " + (Number(e.amount) >= 0 ? "text-success" : "text-destructive")}>
                {Number(e.amount) >= 0 ? "+" : "−"}{formatZAR(Math.abs(Number(e.amount)))}
              </div>
            </div>
          ))}
          {!(ledger?.length) && <div className="text-xs text-muted-foreground py-3">No transactions yet — buy a property to start earning.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
