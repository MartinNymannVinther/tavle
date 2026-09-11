import type { FlowDay } from "@/modules/boards/metrics/flow";
import { CHART, Frame, plotWidth, scaleY, SERIES, XLabel } from "./chart-bits";

/**
 * The cumulative flow: the columns stacked day by day, done at the
 * bottom, so the band of work in progress is the thing the eye lands on.
 * A band that widens is the picture of a queue; that is the whole
 * reason to draw it.
 */
export function FlowChart({
  data,
  ariaLabel,
  legend,
}: {
  data: FlowDay[];
  ariaLabel: string;
  legend: Record<"backlog" | "todo" | "doing" | "done", string>;
}) {
  const order = ["done", "doing", "todo", "backlog"] as const;
  const totals = data.map((d) => order.reduce((t, k) => t + d.counts[k], 0));
  const yMax = Math.max(1, ...totals);
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => CHART.left + (i / n) * plotWidth();
  const base = CHART.top + (CHART.height - CHART.top - CHART.bottom);

  // Each band is drawn from its lower edge (the sum of the bands below it)
  // up to its upper edge, as one closed polygon.
  const lower = data.map(() => 0);
  const bands = order.map((key) => {
    const upper = data.map((d, i) => lower[i]! + d.counts[key]);
    const path = [
      ...upper.map((v, i) => `${x(i)},${scaleY(v, yMax)}`),
      ...lower.map((v, i) => `${x(i)},${scaleY(v, yMax)}`).reverse(),
    ].join(" ");
    for (let i = 0; i < lower.length; i++) lower[i] = upper[i]!;
    return { key, path };
  });
  const labelEvery = data.length > 20 ? 7 : 3;

  return (
    <div className="flex flex-col gap-2">
      <Frame ariaLabel={ariaLabel} yMax={yMax}>
        {bands.map((band) => (
          <polygon
            key={band.key}
            points={band.path}
            fill={SERIES[band.key]}
            fillOpacity={band.key === "done" ? 0.55 : 0.75}
            stroke="none"
          />
        ))}
        <line
          x1={CHART.left}
          x2={CHART.width - CHART.right}
          y1={base}
          y2={base}
          stroke="var(--border)"
        />
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <XLabel
              key={d.date}
              x={x(i)}
              label={`${d.date.slice(8, 10).replace(/^0/, "")}/${d.date.slice(5, 7).replace(/^0/, "")}`}
            />
          ) : null,
        )}
      </Frame>
      <ul className="text-meta flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem]">
        {order.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: SERIES[key], opacity: key === "done" ? 0.55 : 0.75 }}
              aria-hidden
            />
            {legend[key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
