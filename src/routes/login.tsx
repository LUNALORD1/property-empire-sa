import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Property Empire SA" },
      { name: "description", content: "Sign in to manage your South African property portfolio." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Welcome to Property Empire SA");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-card p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-gold grid place-items-center shadow-gold">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">Property Empire</div>
            <div className="text-xs text-muted-foreground -mt-0.5">South Africa</div>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-5xl font-bold tracking-tight leading-[1.05]">
            Build your <span className="text-gradient-gold">SA property</span> empire.
          </h1>
          <p className="text-muted-foreground text-lg">
            Buy real listings across Cape Town, Joburg, Pretoria, Durban &amp; PE.
            Collect rent every day. 1 real day = 1 in-game month.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { k: "R500k", v: "Starting cash" },
              { k: "70+", v: "Live listings" },
              { k: "5", v: "SA cities" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl bg-card/60 border border-border p-4">
                <div className="text-2xl font-bold text-gradient-gold">{s.k}</div>
                <div className="text-xs text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© Property Empire SA</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-gold grid place-items-center shadow-gold">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold tracking-tight">Property Empire SA</div>
              <div className="text-xs text-muted-foreground -mt-0.5">Real estate sim</div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signup"
                ? "Start with R500,000 and 70+ properties on the market."
                : "Pick up where you left off — rent's been collecting."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naledi" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-gold hover:opacity-90 text-primary-foreground font-semibold shadow-gold h-11">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground text-center">
            {mode === "signup" ? "Already playing? " : "New to the game? "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}