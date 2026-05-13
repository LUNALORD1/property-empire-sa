import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { Crown, Trophy, X } from "lucide-react";

export function CollectionInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div
        className="fixed inset-0 grid place-items-center bg-black/80 backdrop-blur p-4 animate-fade-in"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md bg-card border border-primary/40 rounded-2xl shadow-gold p-5 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted hover:bg-muted/70 grid place-items-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Trophy &amp; Prestige Collection</h2>
          </div>
          <div className="space-y-3 text-sm">
            <section>
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Trophy className="w-4 h-4" /> Trophy properties (Tier 5)
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                R12M+ luxury homes — the rarest and most prestigious listings in the country.
              </p>
            </section>
            <section>
              <div className="flex items-center gap-2 font-semibold text-violet-300">
                <Crown className="w-4 h-4" /> Prestige properties (Tier 4)
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                R4M–R12M premium properties in the most sought-after suburbs.
              </p>
            </section>
            <section>
              <div className="font-semibold">Why collect them?</div>
              <p className="text-muted-foreground text-xs mt-1">
                Trophy &amp; Prestige tiers appreciate the fastest and generate the highest absolute rental income —
                a single Trophy can outperform a portfolio of Entry tier homes.
              </p>
            </section>
            <section>
              <div className="font-semibold">How to acquire</div>
              <p className="text-muted-foreground text-xs mt-1">
                Open the <strong>Market</strong> tab and filter by Prestige or Trophy tier — listings rotate daily.
              </p>
            </section>
          </div>
          <Button onClick={onClose} className="w-full mt-4">Got it</Button>
        </div>
      </div>
    </Overlay>
  );
}
