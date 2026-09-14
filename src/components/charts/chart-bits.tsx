/**
 * The little pieces every chart on the insight page is drawn from. Pure
 * SVG in the family's tokens, no library: the charts are few, small and
 * static, and a chart library is a dependency bought for nothing.
 */

export const CHART = {
  width: 640,
  height: 220,
  left: 36,
  right: 12,
  top: 12,
  bottom: 28,
};

export function plotWidth() {
  return CHART.width - CHART.left - CHART.right;
}

export function plotHeight() {
  return CHART.height - CHART.top - CHART.bottom;
}

/** Evenly spaced y ticks that land on round numbers. */
export function yTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  if ((ticks.at(-1) ?? 0) < max) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}

export function Frame({
  ariaLabel,
  children,
  yMax,
  yFormat = (v) => String(v),
}: {
  ariaLabel: string;
  children: React.ReactNode;
  yMax: number;
  yFormat?: (v: number) => string;
}) {
  const ticks = yTicks(yMax);
  const top = ticks.at(-1) || 1;
  const y = (v: number) => CHART.top + plotHeight() - (v / top) * plotHeight();
  return (
    <svg
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full max-w-full text-2xs"
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={CHART.left}
            x2={CHART.width - CHART.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--hairline)"
            strokeWidth={1}
          />
          <text x={CHART.left - 6} y={y(tick) + 3.5} textAnchor="end" fill="var(--label)">
            {yFormat(tick)}
          </text>
        </g>
      ))}
      {children}
    </svg>
  );
}

/** Where a value lands on the y axis, given the frame's rounded top. */
export function scaleY(value: number, yMax: number): number {
  const top = yTicks(yMax).at(-1) || 1;
  return CHART.top + plotHeight() - (value / top) * plotHeight();
}

export function XLabel({ x, label }: { x: number; label: string }) {
  return (
    <text x={x} y={CHART.height - 8} textAnchor="middle" fill="var(--label)">
      {label}
    </text>
  );
}

export const SERIES = {
  primary: "var(--primary)",
  ideal: "var(--label)",
  done: "var(--success)",
  doing: "var(--primary)",
  todo: "var(--chart-2)",
  backlog: "var(--chart-3)",
  committed: "var(--accent)",
} as const;
