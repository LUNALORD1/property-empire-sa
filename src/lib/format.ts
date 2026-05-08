export function formatZAR(amount: number, opts?: { compact?: boolean }) {
  const v = Number(amount) || 0;
  if (opts?.compact && Math.abs(v) >= 1_000_000) {
    return "R" + (v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2) + "M";
  }
  if (opts?.compact && Math.abs(v) >= 10_000) {
    return "R" + Math.round(v / 1000) + "k";
  }
  return "R" + v.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

export function formatSigned(amount: number) {
  const v = Number(amount) || 0;
  return (v >= 0 ? "+" : "−") + "R" + Math.abs(v).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}