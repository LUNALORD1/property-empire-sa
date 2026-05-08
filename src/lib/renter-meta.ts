import {
  Briefcase,
  Building,
  Flower,
  GraduationCap,
  Music,
  Rocket,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

export type RenterMeta = {
  icon: LucideIcon;
  /** tailwind classes for the gradient header strip */
  gradient: string;
  /** ring/border accent */
  accent: string;
  /** soft background tint for icon chip */
  chipBg: string;
  /** subtitle / tagline */
  tagline: string;
};

export const RENTER_META: Record<string, RenterMeta> = {
  young_professional: {
    icon: Briefcase,
    gradient: "from-sky-500/30 via-sky-400/10 to-transparent",
    accent: "border-sky-400/50 shadow-[0_0_30px_-10px] shadow-sky-500/40",
    chipBg: "bg-sky-500/20 text-sky-200",
    tagline: "Steady earner, easy admin",
  },
  family: {
    icon: Users,
    gradient: "from-emerald-500/30 via-emerald-400/10 to-transparent",
    accent: "border-emerald-400/50 shadow-[0_0_30px_-10px] shadow-emerald-500/40",
    chipBg: "bg-emerald-500/20 text-emerald-200",
    tagline: "Long stays, treats it like home",
  },
  retiree: {
    icon: Flower,
    gradient: "from-rose-400/30 via-rose-300/10 to-transparent",
    accent: "border-rose-300/50 shadow-[0_0_30px_-10px] shadow-rose-400/40",
    chipBg: "bg-rose-400/20 text-rose-200",
    tagline: "Ultra-reliable, multi-year lease",
  },
  student: {
    icon: GraduationCap,
    gradient: "from-indigo-500/30 via-indigo-400/10 to-transparent",
    accent: "border-indigo-400/50 shadow-[0_0_30px_-10px] shadow-indigo-500/40",
    chipBg: "bg-indigo-500/20 text-indigo-200",
    tagline: "University crowd, short leases",
  },
  entrepreneur: {
    icon: Rocket,
    gradient: "from-violet-500/30 via-violet-400/10 to-transparent",
    accent: "border-violet-400/50 shadow-[0_0_30px_-10px] shadow-violet-500/40",
    chipBg: "bg-violet-500/20 text-violet-200",
    tagline: "Pays a premium, can be erratic",
  },
  corporate_tenant: {
    icon: Building,
    gradient: "from-amber-500/30 via-amber-400/10 to-transparent",
    accent: "border-amber-400/50 shadow-[0_0_30px_-10px] shadow-amber-500/40",
    chipBg: "bg-amber-500/20 text-amber-200",
    tagline: "Top dollar, white-glove tenant",
  },
  party_animal: {
    icon: Music,
    gradient: "from-fuchsia-500/30 via-pink-500/10 to-transparent",
    accent: "border-fuchsia-400/50 shadow-[0_0_30px_-10px] shadow-fuchsia-500/40",
    chipBg: "bg-fuchsia-500/20 text-fuchsia-200",
    tagline: "High rent — and high risk",
  },
  opportunist: {
    icon: AlertTriangle,
    gradient: "from-orange-500/30 via-red-500/10 to-transparent",
    accent: "border-orange-400/50 shadow-[0_0_30px_-10px] shadow-orange-500/40",
    chipBg: "bg-orange-500/20 text-orange-200",
    tagline: "Lowballer — handle with care",
  },
};

export const DAMAGE_RISK_META: Record<
  "very_low" | "low" | "medium" | "high",
  { label: string; cls: string }
> = {
  very_low: { label: "Very low risk", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" },
  low: { label: "Low risk", cls: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
  medium: { label: "Medium risk", cls: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  high: { label: "High risk", cls: "bg-red-500/20 text-red-200 border-red-400/40" },
};

export function rentMetaFor(key: string): RenterMeta {
  return (
    RENTER_META[key] ?? {
      icon: Briefcase,
      gradient: "from-slate-500/30 via-slate-400/10 to-transparent",
      accent: "border-slate-400/50",
      chipBg: "bg-slate-500/20 text-slate-200",
      tagline: "",
    }
  );
}