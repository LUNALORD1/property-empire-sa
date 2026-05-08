import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerProperties } from "@/lib/data-hooks";
import { formatZAR } from "@/lib/format";
import { Bed, Bath, Building2, TrendingUp, ArrowRight } from "lucide-react";

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
      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((p) => {
          const cashflow = Number(p.monthly_rent) - Number(p.monthly_maintenance);
          return (
            <div key={p.id} className="rounded-2xl bg-gradient-card border border-border overflow-hidden shadow-card">
              <div className="aspect-[16/9] bg-muted relative">
                {p.property?.photo_url && <img src={p.property.photo_url} alt={p.property.address} className="w-full h-full object-cover" />}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-background/85 text-[10px] font-semibold uppercase tracking-wide">{p.status}</div>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <div className="text-sm font-semibold leading-tight">{p.property?.suburb}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.property?.address}</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.property?.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.property?.bathrooms}</span>
                  <span className="ml-auto flex items-center gap-1 text-success"><TrendingUp className="w-3 h-3" />{formatZAR(Number(p.current_value), { compact: true })}</span>
                </div>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
