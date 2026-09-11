import type { Burndown } from "@/modules/boards/metrics/burndown";
import { CHART, Frame, plotWidth, scaleY, SERIES, XLabel } from "./chart-bits";

/**
 * Remaining points day by day against the straight line the team would
 * follow if the sprint burned evenly. The real line stops at today; what
 * has not happened is not drawn.
 */
export function BurndownChart({ data, ariaLabel }: { data: Burndown; ariaLabel: string }) {
  const points = data.points;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => CHART.left + (i / n) * plotWidth();
  const yMax = Math.max(data.committed, ...points.map((p) => p.remaining ?? 0), 1);
  const ideal = points.map((p, i) => `${x(i)},${scaleY(p.ideal, yMax)}`).join(" ");
  const actual = points
    .filter((p) => p.remaining !== null)
    .map((p, i) => `${x(i)},${scaleY(p.remaining!, yMax)}`)
    .join(" ");
  const labelEvery = points.length > 16 ? 4 : points.length > 8 ? 2 : 1;

  return (
    <Frame ariaLabel={ariaLabel} yMax={yMax}>
      <polyline
        points={ideal}
        fill="none"
        stroke={SERIES.ideal}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {actual && (
        <polyline
          points={actual}
          fill="none"
          stroke={SERIES.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
      {points.map((p, i) =>
        p.remaining === null ? null : (
          <circle
            key={p.date}
            cx={x(i)}
            cy={scaleY(p.remaining, yMax)}
            r={3}
            fill={SERIES.primary}
          />
        ),
      )}
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <XLabel key={p.date} x={x(i)} label={p.date.slice(8, 10).replace(/^0/, "")} />
        ) : null,
      )}
    </Frame>
  );
}
