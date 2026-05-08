import { AlertTriangle } from "lucide-react";

export function RedZoneBanner({
  cash,
  redZoneStartedAt,
}: {
  cash: number;
  redZoneStartedAt: string | null;
}) {
  if (cash >= 0 || !redZoneStartedAt) return null;
  const startMs = new Date(redZoneStartedAt + "T00:00:00").getTime();
  const day = Math.max(1, Math.floor((Date.now() - startMs) / 86400000) + 1);
  const remaining = Math.max(0, 3 - day);
  const messages = [
    "A tenant has walked out under the strain.",
    "A property is being force-sold at a 15% loss tomorrow.",
    "One more day in the red and your empire collapses.",
  ];
  const msg = messages[Math.min(day - 1, 2)];
  return (
    <div className="sticky top-[56px] z-20 bg-gradient-to-r from-red-600/90 via-red-500/90 to-red-600/90 text-white border-b border-red-300/40 shadow-[0_4px_20px_-5px] shadow-red-700/60 animate-pulse">
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-semibold">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="uppercase tracking-wider mr-2">Red Zone · Day {day}/3</span>
          <span className="font-medium opacity-90">{msg}</span>
        </div>
        <div className="hidden sm:block text-[10px] opacity-80 shrink-0">
          {remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} to recover` : "GAME OVER imminent"}
        </div>
      </div>
    </div>
  );
}