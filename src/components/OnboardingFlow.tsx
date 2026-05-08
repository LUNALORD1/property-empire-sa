import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, Hand, CalendarClock, ArrowRight, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import skyline from "@/assets/onboarding-skyline.jpg";
import { Z } from "@/lib/z";

const STEP_KEY = "pe.onboarding.step";

type Step = 1 | 2 | 3 | 4;

export function OnboardingFlow({
  userId, displayName, ownsAny, onComplete,
}: {
  userId: string;
  displayName?: string | null;
  ownsAny: boolean;
  onComplete: () => void;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState<Step>(() => {
    const s = Number(localStorage.getItem(STEP_KEY));
    return (s >= 1 && s <= 4 ? s : 1) as Step;
  });
  const [name, setName] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { localStorage.setItem(STEP_KEY, String(step)); }, [step]);

  // Auto-advance to step 4 once they own a property (after step 3).
  useEffect(() => {
    if (ownsAny && step === 3) setStep(4);
  }, [ownsAny, step]);

  async function finish() {
    setBusy(true);
    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    localStorage.removeItem(STEP_KEY);
    qc.invalidateQueries({ queryKey: ["profile", userId] });
    setBusy(false);
    onComplete();
  }

  async function saveNameAndAdvance() {
    const trimmed = name.trim().slice(0, 40);
    setBusy(true);
    if (trimmed) {
      await supabase.from("profiles").update({ display_name: trimmed }).eq("id", userId);
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    }
    setBusy(false);
    setStep(2);
    if (loc.pathname !== "/") nav({ to: "/" });
  }

  // ---- Step 1: full-screen "Name your empire" ----
  if (step === 1) {
    return (
      <OverlayPortal>
      <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-background animate-fade-in" style={{ zIndex: Z.onboardingFull }}>
        <div className="absolute inset-0 overflow-hidden">
          <img src={skyline} alt="" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>
        <div className="relative w-full sm:max-w-md p-6 sm:p-8 sm:rounded-3xl bg-card/85 backdrop-blur-xl border-t sm:border border-primary/30 sm:shadow-gold animate-scale-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-gold grid place-items-center shadow-gold mb-4">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Welcome</div>
          <h2 className="text-3xl font-bold leading-tight mt-1">Name your empire</h2>
          <p className="text-sm text-muted-foreground mt-2">
            From Sea Point to Sandton — what should we call your property dynasty?
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Khumalo Holdings"
            maxLength={40}
            className="mt-5 h-12 text-base bg-background/60"
            onKeyDown={(e) => { if (e.key === "Enter") saveNameAndAdvance(); }}
            autoFocus
          />
          <Button
            onClick={saveNameAndAdvance}
            disabled={busy}
            className="w-full mt-4 h-12 bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold text-base"
          >
            Start building <ArrowRight className="w-4 h-4" />
          </Button>
          <button onClick={finish} disabled={busy} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-2">
            Skip intro
          </button>
        </div>
      </div>
      </OverlayPortal>
    );
  }

  // Steps 2/3 only show on the map page.
  const onMap = loc.pathname === "/";

  // ---- Step 2: legend / pins explainer ----
  if (step === 2) {
    if (!onMap) { nav({ to: "/" }); return null; }
    return (
      <Coachmark anchor="top" onSkip={finish}>
        <CoachIcon icon={<MapPin className="w-5 h-5" />} />
        <CoachTitle>Read the map</CoachTitle>
        <CoachBody>
          <span className="inline-flex items-center gap-1.5"><Dot color="oklch(0.82 0.14 85)" /> gold pins are <b>for sale</b></span><br />
          <span className="inline-flex items-center gap-1.5"><Dot color="oklch(0.62 0.18 155)" /> green pins are <b>rented</b> (yours)</span><br />
          <span className="inline-flex items-center gap-1.5"><Dot color="oklch(0.75 0.18 70)" /> orange pins are <b>vacant</b></span>
          <span className="block mt-2 pt-2 border-t border-border/50">
            <ZoomIn className="w-3.5 h-3.5 inline mr-1 text-primary" />
            <b>Pinch or scroll</b> to zoom into a city — pins cluster tight in
            Cape Town, Joburg & Durban.
          </span>
        </CoachBody>
        <CoachActions>
          <Button onClick={() => setStep(3)} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold h-10 px-5">
            Got it
          </Button>
        </CoachActions>
      </Coachmark>
    );
  }

  // ---- Step 3: nudge to tap a pin ----
  if (step === 3) {
    if (!onMap) { nav({ to: "/" }); return null; }
    return (
      <Coachmark anchor="bottom" onSkip={finish}>
        <CoachIcon icon={<Hand className="w-5 h-5" />} />
        <CoachTitle>Tap any gold pin to buy</CoachTitle>
        <CoachBody>
          You start with <b>R350,000</b> in cash — enough to buy an Entry-tier property outright. Pick a property on the map, then tap{" "}
          <span className="text-primary font-semibold">Buy</span>. Your first one must be cash —
          bonds unlock after that.
          <span className="block mt-2 pt-2 border-t border-border/50 text-foreground/80">
            Tip: buying <b>3+ properties in the same city</b> unlocks area
            achievements and makes managing your empire easier.
          </span>
        </CoachBody>
      </Coachmark>
    );
  }

  // ---- Step 4: daily tick explainer ----
  if (step === 4) {
    return (
      <OverlayPortal>
      <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur p-4 animate-fade-in" style={{ zIndex: Z.onboardingFull }}>
        <div className="relative w-full sm:max-w-sm bg-card border border-primary/30 rounded-3xl shadow-gold overflow-hidden animate-scale-in">
          <div className="h-1 w-full bg-gradient-gold" />
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto grid place-items-center bg-primary/15 text-primary mb-3">
              <CalendarClock className="w-7 h-7" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">You're in business</div>
            <h3 className="text-2xl font-bold mt-1">One real day = one in-game month</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Every day we'll <b className="text-success">collect rent</b>, deduct{" "}
              <b className="text-destructive">maintenance</b> and bond repayments, and pop up a
              summary so you know where your empire stands.
            </p>
            <Button onClick={finish} disabled={busy} className="w-full mt-5 h-11 bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
              Let's go
            </Button>
          </div>
        </div>
      </div>
      </OverlayPortal>
    );
  }

  return null;
}

// ---------- coachmark primitives ----------

function Coachmark({ children, anchor, onSkip }: { children: React.ReactNode; anchor: "top" | "bottom"; onSkip: () => void }) {
  // Non-blocking pointer overlay so users can still tap pins on the map.
  return (
    <OverlayPortal>
    <div className="fixed inset-0 pointer-events-none animate-fade-in" style={{ zIndex: Z.onboardingCoach }}>
      <div
        className={
          "absolute left-1/2 -translate-x-1/2 w-[min(92vw,22rem)] pointer-events-auto " +
          (anchor === "top" ? "top-16" : "bottom-24")
        }
      >
        <div className="rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/40 shadow-gold p-4 animate-scale-in">
          <button
            onClick={onSkip}
            className="absolute -top-2 -right-2 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-full bg-card border border-border text-muted-foreground hover:text-foreground shadow-card"
          >
            Skip
          </button>
          {children}
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

function OverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}

function CoachIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary grid place-items-center mb-2">{icon}</div>
  );
}
function CoachTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-base font-bold leading-tight">{children}</div>;
}
function CoachBody({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{children}</div>;
}
function CoachActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end mt-3">{children}</div>;
}
function Dot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />;
}