"use client";

import { useTranslations } from "next-intl";
import type { EstimateUnit } from "@/core/db/schema";
import type { RoadmapRelease } from "@/modules/boards/structure/roadmap";
import { totalLabel } from "@/modules/boards/estimates";
import { cn } from "@/lib/utils";

/**
 * The releases as one thin strip above the epics (docs/adr/0032), each
 * standing on the quarter its date falls in. It answers the question
 * the epic bars cannot: what ships together, and roughly when.
 *
 * A release with no date is left off rather than parked at the edge —
 * a time axis has no honest place for something with no time — and the
 * strip says how many are waiting that way.
 */
export function ReleaseStrip({
  releases,
  columns,
  unit,
}: {
  releases: RoadmapRelease[];
  columns: number;
  unit: EstimateUnit;
}) {
  const t = useTranslations("roadmap.releases");
  const dated = releases.filter((r) => r.at !== null);
  const undated = releases.length - dated.length;

  // Two markers closer than this share of the axis would overlap, so the
  // later one steps down a lane. Measured against the widest label the
  // strip allows, not guessed.
  const MIN_GAP = 0.9;
  const taken: number[][] = [];
  const laneOf = dated.map((row) => {
    const at = row.at!;
    let lane = 0;
    while ((taken[lane] ?? []).some((other) => Math.abs(other - at) < MIN_GAP)) lane += 1;
    taken[lane] = [...(taken[lane] ?? []), at];
    return lane;
  });
  const lanes = Math.max(1, taken.length);

  if (releases.length === 0) return null;

  return (
    <div
      className="border-hairline grid items-stretch border-b"
      style={{ gridTemplateColumns: `16rem repeat(${columns}, minmax(0, 1fr))` }}
    >
      <div className="flex flex-col gap-0.5 px-4 py-2">
        <span className="text-label text-xs font-medium">{t("title")}</span>
        {undated > 0 && (
          <span className="text-meta text-2xs">{t("undated", { count: undated })}</span>
        )}
      </div>
      <div
        className="relative col-span-full col-start-2 py-2"
        style={{ minHeight: `${2.75 + (lanes - 1) * 1.6}rem` }}
      >
        {dated.map((row, index) => {
          // The marker sits where the date falls, as a share of the axis.
          const left = (row.at! / columns) * 100;
          // Releases land close together often — a quarter is three months
          // and a team ships more than once in it. Rather than painting
          // over each other, a marker steps down a lane until it clears
          // the ones already placed.
          const lane = laneOf[index]!;
          const share = row.points > 0 ? Math.round((row.donePoints / row.points) * 100) : 0;
          const weight = row.points > 0 ? totalLabel(row.points, unit) : null;
          return (
            <span
              key={row.release.id}
              className={cn(
                "bg-card border-border absolute flex max-w-52 -translate-x-1/2 items-center gap-1.5",
                "rounded-full border px-2 py-0.5 text-2xs shadow-[var(--surface-shadow)]",
              )}
              style={{
                left: `${Math.min(99, Math.max(1, left))}%`,
                top: `${0.375 + lane * 1.6}rem`,
              }}
              title={t("tip", { cards: row.cards, done: share })}
            >
              <span
                aria-hidden
                className="bg-primary size-1.5 shrink-0 rounded-full"
                style={{ opacity: share === 100 ? 1 : 0.45 }}
              />
              <span className="min-w-0 truncate font-medium">{row.release.name}</span>
              {weight && <span className="text-meta shrink-0 tabular-nums">{weight}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
