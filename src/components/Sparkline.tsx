/**
 * Tiny inline SVG sparkline. No deps.
 */
export function Sparkline({
  values,
  width = 80,
  height = 22,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!values || values.length < 2) {
    return <div className={"text-[10px] text-muted-foreground/60 " + className}>—</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "hsl(var(--success, 142 70% 45%))" : "hsl(var(--destructive))";
  // Use Tailwind currentColor instead — simpler and themable
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={(up ? "text-success" : "text-destructive") + " " + className}
      aria-hidden
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}