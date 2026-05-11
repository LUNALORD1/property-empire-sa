import { useEffect, useState } from "react";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";
import { Button } from "@/components/ui/button";
import { PropertyImage } from "@/components/PropertyImage";
import { setPropertyNickname } from "@/lib/tenants";
import { Input } from "@/components/ui/input";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Property } from "@/lib/game";

export function AcquisitionCelebration({
  property,
  playerPropertyId,
  ownerName,
  onClose,
}: {
  property: Property;
  playerPropertyId: string;
  ownerName: string;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [stage, setStage] = useState<"reveal" | "name">("reveal");

  useEffect(() => {
    const t = setTimeout(() => setStage("name"), 1700);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const trimmed = nickname.trim().slice(0, 40);
    if (trimmed) {
      try { await setPropertyNickname({ playerPropertyId, nickname: trimmed }); }
      catch (e: any) { toast.error(e?.message ?? "Could not save nickname"); }
    }
    onClose();
  }

  // Confetti via 30 random gold/amber dots animating downward
  const confetti = Array.from({ length: 36 }).map((_, i) => i);

  return (
    <Overlay onClose={onClose}>
      <div className="fixed inset-0 z-[1000000] grid place-items-center bg-black/90 backdrop-blur-md p-3 animate-fade-in">
        {/* Confetti layer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 1.2;
            const dur = 2.4 + Math.random() * 2.6;
            const colors = ["#f3c869", "#d99a3a", "#fff3c5", "#9d6b1d"];
            const c = colors[i % colors.length];
            const size = 6 + Math.floor(Math.random() * 10);
            return (
              <span
                key={i}
                className="absolute -top-4 rounded-sm"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size * 1.5,
                  background: c,
                  animation: `confetti ${dur}s ${delay}s linear infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            );
          })}
        </div>

        <div
          className="relative w-full max-w-md bg-card border border-primary/40 rounded-3xl shadow-gold overflow-hidden"
          style={{ zIndex: Z.modal }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <div className="absolute inset-0 animate-celebration-zoom origin-center">
              <PropertyImage
                propertyId={property.id}
                listingPrice={property.listing_price}
                address={property.address}
                locality={property.suburb}
                alt={property.address}
                loading="eager"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* Acquired stamp */}
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div
                className="border-[6px] border-primary text-primary text-4xl font-black tracking-[0.15em] px-6 py-2 -rotate-12 animate-stamp uppercase"
                style={{ fontFamily: "'Times New Roman', serif", textShadow: "2px 2px 0 rgba(0,0,0,0.4)" }}
              >
                Acquired
              </div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-primary" /> Empire — {ownerName}
              </div>
              <div className="text-lg font-bold leading-tight">{property.suburb}</div>
              <div className="text-xs opacity-80 truncate">{property.address}</div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {stage === "name" ? (
              <>
                <div className="text-sm font-semibold">Give it a nickname</div>
                <p className="text-xs text-muted-foreground">
                  Show off your portfolio with a memorable name. Shown on the portfolio card instead of the address.
                </p>
                <Input
                  autoFocus
                  maxLength={40}
                  placeholder="The Beach House…"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-11"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button variant="outline" onClick={onClose} className="h-11">Skip</Button>
                  <Button onClick={save} className="h-11 bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-3">
                Welcome to the empire…
              </div>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}