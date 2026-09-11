import type { WeekCount } from "@/modules/boards/metrics/flow";
import type { Velocity } from "@/modules/boards/metrics/velocity";
import { CHART, Frame, plotHeight, plotWidth, scaleY, SERIES, XLabel } from "./chart-bits";

/** Points completed per closed sprint, with what was committed behind it in the accent tint. */
export function VelocityChart({ data, ariaLabel }: { data: Velocity; ariaLabel: string }) {
  const bars = data.bars;
  const yMax = Math.max(1, ...bars.map((b) => Math.max(b.committed, b.completed)));
  const slot = plotWidth() / Math.max(bars.length, 1);
  const width = Math.min(48, slot * 0.6);
  const base = CHART.top + plotHeight();
  return (
    <Frame ariaLabel={ariaLabel} yMax={yMax}>
      {bars.map((bar, i) => {
        const cx = CHART.left + slot * i + slot / 2;
        return (
          <g key={bar.sprintId}>
            <rect
              x={cx - width / 2 - 3}
              y={scaleY(bar.committed, yMax)}
              width={width + 6}
              height={base - scaleY(bar.committed, yMax)}
              fill={SERIES.committed}
              rx={3}
            />
            <rect
              x={cx - width / 2}
              y={scaleY(bar.completed, yMax)}
              width={width}
              height={base - scaleY(bar.completed, yMax)}
              fill={SERIES.done}
              rx={3}
            />
            <text
              x={cx}
              y={scaleY(bar.completed, yMax) - 4}
              textAnchor="middle"
              fill="var(--foreground)"
              fontWeight={600}
            >
              {bar.completed}
            </text>
            <XLabel x={cx} label={bar.name.length > 10 ? `${bar.name.slice(0, 9)}…` : bar.name} />
          </g>
        );
      })}
      {data.average !== null && (
        <line
          x1={CHART.left}
          x2={CHART.width - CHART.right}
          y1={scaleY(data.average, yMax)}
          y2={scaleY(data.average, yMax)}
          stroke={SERIES.ideal}
          strokeDasharray="4 4"
        />
      )}
    </Frame>
  );
}

/** Cards finished per week, oldest first. */
export function ThroughputChart({ data, ariaLabel }: { data: WeekCount[]; ariaLabel: string }) {
  const yMax = Math.max(1, ...data.map((w) => w.count));
  const slot = plotWidth() / Math.max(data.length, 1);
  const width = Math.min(40, slot * 0.6);
  const base = CHART.top + plotHeight();
  return (
    <Frame ariaLabel={ariaLabel} yMax={yMax}>
      {data.map((week, i) => {
        const cx = CHART.left + slot * i + slot / 2;
        return (
          <g key={week.week}>
            <rect
              x={cx - width / 2}
              y={scaleY(week.count, yMax)}
              width={width}
              height={base - scaleY(week.count, yMax)}
              fill={SERIES.primary}
              rx={3}
            />
            {week.count > 0 && (
              <text
                x={cx}
                y={scaleY(week.count, yMax) - 4}
                textAnchor="middle"
                fill="var(--foreground)"
                fontWeight={600}
              >
                {week.count}
              </text>
            )}
            <XLabel x={cx} label={week.week.replace(/^\d{4}-W/, "U")} />
          </g>
        );
      })}
    </Frame>
  );
}
