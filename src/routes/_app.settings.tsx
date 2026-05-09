import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/lib/data-hooks";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resetPlayer } from "@/lib/tenants";
import { Bell, BellOff, Loader2, RotateCcw, Save, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { Overlay } from "@/components/Overlay";
import { Z } from "@/lib/z";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Property Empire SA" },
      { name: "description", content: "Manage your empire settings, preferences, and reset options." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const [name, setName] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setNotifications((profile as any).notifications_enabled ?? true);
    }
  }, [profile]);

  async function saveName() {
    if (!user || !name.trim()) return;
    setSavingName(true);
    try {
      await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Display name saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setSavingName(false); }
  }

  async function toggleNotifications(next: boolean) {
    if (!user) return;
    setNotifications(next);
    await supabase.from("profiles").update({ notifications_enabled: next } as any).eq("id", user.id);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast(next ? "Daily tick notifications on" : "Daily tick notifications off");
  }

  async function doReset() {
    if (!user) return;
    setResetting(true);
    try {
      await resetPlayer(user.id);
      toast.success("Empire reset — fresh start with R500,000");
      qc.invalidateQueries();
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Reset failed");
    } finally { setResetting(false); setConfirmReset(false); }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto w-full overflow-y-auto pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold">Display name</div>
          <div className="text-xs text-muted-foreground">How you appear on the leaderboard.</div>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button onClick={saveName} disabled={savingName || !name.trim()} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </Button>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
            {notifications ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Daily tick notifications</div>
            <div className="text-xs text-muted-foreground">Show the daily tick recap modal each day.</div>
          </div>
          <button
            onClick={() => toggleNotifications(!notifications)}
            className={"relative w-11 h-6 rounded-full transition-colors " + (notifications ? "bg-gradient-gold" : "bg-muted")}
            aria-pressed={notifications}
          >
            <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-background shadow transition-all " + (notifications ? "left-[1.4rem]" : "left-0.5")} />
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-destructive/5 border border-destructive/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-destructive">Reset Empire</div>
            <div className="text-xs text-muted-foreground">
              Permanently delete all properties, tenants, loans, ledger history, and assistants. Achievements are preserved. Cash resets to R500,000.
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setConfirmReset(true)}
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="w-4 h-4" /> Reset Empire
        </Button>
      </section>

      {confirmReset && (
        <Overlay onClose={() => !resetting && setConfirmReset(false)}>
          <div
            className="fixed inset-0 grid place-items-center bg-black/70 backdrop-blur p-4 animate-fade-in"
            style={{ zIndex: Z.modal }}
            onClick={() => !resetting && setConfirmReset(false)}
          >
            <div
              className="w-full max-w-sm bg-card border border-destructive/40 rounded-2xl shadow-card p-5 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/15 text-destructive grid place-items-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-center">Reset your empire?</h2>
              <p className="text-sm text-muted-foreground text-center mt-2">
                All progress except achievements will be lost. This cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button variant="outline" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button
                  onClick={doReset}
                  disabled={resetting}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
