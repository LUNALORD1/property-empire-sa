import { Button } from "@/components/ui/button";
import { formatZAR, formatSigned } from "@/lib/format";
import { Sparkles, TrendingUp, Wrench } from "lucide-react";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";

export function DailyTickModal({ rent, maintenance, net, onClose }: {
  rent: number; maintenance: number; net: number; onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur p-4" style={{ zIndex: Z.modal }} onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-primary/30 rounded-2xl shadow-gold overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-gold p-4 text-center text-primary-foreground">
          <Sparkles className="w-5 h-5 mx-auto mb-1" />
          <div className="text-sm font-semibold uppercase tracking-wider">Month closed</div>
          <div className="text-xs opacity-80">Daily summary — your in-game month is in the books</div>
        </div>
        <div className="p-5 space-y-3">
          <Row icon={<TrendingUp className="w-4 h-4 text-success" />} label="Rent collected" value={"+" + formatZAR(rent)} good />
          <Row icon={<Wrench className="w-4 h-4 text-destructive" />} label="Maintenance paid" value={"−" + formatZAR(maintenance)} />
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="text-sm font-medium">Net cash flow</div>
            <div className={"text-xl font-bold tabular-nums " + (net >= 0 ? "text-success" : "text-destructive")}>{formatSigned(net)}</div>
          </div>
          <Button onClick={onClose} className="w-full mt-2 bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold">Continue</Button>
        </div>
      </div>
    </div>
    </Overlay>
  );
}

function Row({ icon, label, value, good }: { icon: React.ReactNode; label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className={"font-semibold tabular-nums " + (good ? "text-success" : "")}>{value}</span>
    </div>
  );
}
