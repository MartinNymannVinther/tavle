"use client";

import { useTranslations } from "next-intl";
import type { EstimateUnit } from "@/core/db/schema";
import type { RoadmapRelease } from "@/modules/boards/structure/roadmap";
import { useEstimateLabel } from "@/components/board/estimate-label";
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
  const { total } = useEstimateLabel();
  const dated = releases.filter((r) => r.at !== null);
  const undated = releases.length - dated.length;

  /**
   * Whether two markers touch is a question in pixels, and this component
   * is never told how wide the strip is: the axis grows with what is
   * planned on it, so the same column is 200px on one board and 40px on
   * another. The lane rule used to compare positions in columns against a
   * gap guessed from a pixel width — two units and no measurement — and
   * markers duly painted over each other.
   *
   * So the pixels are taken out of the question. A marker is given at
   * most two columns of the axis, capped in CSS where the strip's own
   * width is known, and two markers less than two columns apart step
   * apart into lanes. Both numbers are this one, so they cannot drift:
   * whatever a column measures, a marker that keeps its distance keeps
   * the half-gutter with it. `overflow-hidden` is what makes that a
   * promise rather than a hope — it holds the pill to the cap even where
   * a column is narrower than the label's shortest line.
   *
   * Two columns rather than one is a choice about reading: one column
   * cuts "Sommer: anmeldelser og drift" to "Sommer: anm…" on a board
   * where there is room for all of it, and a lane costs a line of strip
   * where a truncation costs the name.
   */
  const MARKER_COLUMNS = 2;
  // The lanes are packed on the position the marker is painted at, edge
  // clamp included, so a date before the axis starts cannot be nudged
  // into a neighbour it was measured clear of.
  const edge = columns / 100;
  const at = (row: RoadmapRelease) => Math.min(columns - edge, Math.max(edge, row.at!));
  const taken: number[][] = [];
  const laneOf = dated.map((row) => {
    const pos = at(row);
    let lane = 0;
    while ((taken[lane] ?? []).some((other) => Math.abs(other - pos) < MARKER_COLUMNS)) lane += 1;
    taken[lane] = [...(taken[lane] ?? []), pos];
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
          const left = (at(row) / columns) * 100;
          // Releases land close together often — a quarter is three months
          // and a team ships more than once in it. Rather than painting
          // over each other, a marker steps down a lane until it clears
          // the ones already placed.
          const lane = laneOf[index]!;
          const share = row.points > 0 ? Math.round((row.donePoints / row.points) * 100) : 0;
          const weight = row.points > 0 ? total(row.points, unit) : null;
          return (
            <span
              key={row.release.id}
              className={cn(
                "bg-card border-border absolute flex -translate-x-1/2 items-center gap-1.5",
                "overflow-hidden rounded-full border px-2 py-0.5 text-2xs",
                "shadow-[var(--surface-shadow)]",
              )}
              style={{
                left: `${left}%`,
                top: `${0.375 + lane * 1.6}rem`,
                // The marker's share of the strip, less the gutter that
                // keeps two of them apart, and never wider than the
                // longest label the strip allows. The lane rule above
                // stands on this number.
                maxWidth: `min(13rem, calc(${MARKER_COLUMNS * 100}% / ${columns} - 0.5rem))`,
              }}
              // The pill has room for a number; the tip has room for the
              // word, so the strip and the map's band say the same thing.
              title={`${t("tip", { cards: row.cards, done: share })}${
                row.points > 0 ? ` · ${t("weight", { unit, points: row.points })}` : ""
              }`}
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
