"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstimateUnit } from "@/core/db/schema";
import { themeSwatch } from "@/components/board/tokens";
import { overview, type Bucket } from "@/modules/boards/structure/overview";
import { backlogCare } from "@/modules/boards/structure/hygiene";
import { SegmentedChoice } from "@/components/ui/segmented";
import { CareClear, CareList, CareSummary } from "./care-list";
import { structureView } from "@/modules/boards/structure/view";
import type { BoardFull } from "@/modules/boards/types";
import { cn } from "@/lib/utils";

/**
 * The overview: where the open work sits, by theme, by area and by kind,
 * the enabler share as one number, and the five health measures that
 * say whether the structure is being kept. A distribution is one bar
 * split into shares — never a row of half-filled lines, which the eye
 * reads as progress that does not exist.
 */
export function OverviewView({ full }: { full: BoardFull }) {
  const t = useTranslations("overview");
  const c = useTranslations("care");
  const s = useTranslations("boards.structure");
  const data = overview(full);
  const careData = backlogCare(full);
  const view = structureView(full.board);
  const unit = (full.board.estimateUnit as EstimateUnit) ?? "points";
  const [axis, setAxis] = useState<"byTheme" | "byArea" | "byKind">(
    view.themes ? "byTheme" : view.areas ? "byArea" : "byKind",
  );

  // A finding about a level the board does not show would be a demand to
  // fix something the team cannot see.
  const shown = careData.findings.filter((finding) => {
    if (finding.key === "review" || finding.key === "emptyEpic") return view.epics;
    if (finding.key === "emptyFeature") return view.features;
    if (finding.key === "unplaced") return view.features;
    return true;
  });

  const axes = (
    [
      ["byTheme", data.byTheme, view.themes],
      ["byArea", data.byArea, view.areas],
      ["byKind", data.byKind, view.kind],
    ] as const
  ).filter(([, , on]) => on);
  const buckets = axes.find(([key]) => key === axis)?.[1] ?? [];
  const name = (bucket: Bucket) =>
    bucket.key === "none"
      ? t("none")
      : bucket.key === "business" || bucket.key === "enabler"
        ? s(`kind.${bucket.key}`)
        : bucket.name;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{c("title")}</CardTitle>
          <CardDescription>{c("body")}</CardDescription>
          <CareSummary
            cards={careData.waiting.cards}
            points={careData.waiting.points}
            unestimated={careData.waiting.unestimated}
            depth={careData.depthInSprints}
            unit={unit}
            boardId={full.board.id}
          />
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {shown.length > 0 ? (
            <CareList findings={shown} boardKey={full.board.key} boardId={full.board.id} />
          ) : (
            <CareClear />
          )}
        </CardContent>
      </Card>

      {axes.length > 0 && (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <CardTitle>{t("weightTitle")}</CardTitle>
                <CardDescription>
                  {t("distributionBody", { unit, cards: data.openCards, points: data.openPoints })}
                </CardDescription>
              </div>
              {axes.length > 1 && (
                <SegmentedChoice<"byTheme" | "byArea" | "byKind">
                  value={axis}
                  onChange={setAxis}
                  options={axes.map(([key]) => ({ value: key, label: t(`${key}Title`) }))}
                  label={t("weightTitle")}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Distribution buckets={buckets} name={name} unit={unit} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Distinct inks for the buckets that have no colour of their own (areas, kinds). */
const BUCKET_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--label)",
];

function Distribution({
  buckets,
  name,
  unit,
}: {
  buckets: Bucket[];
  name: (bucket: Bucket) => string;
  /** What the board counts in, so each weight is named right (docs/adr/0030). */
  unit: EstimateUnit;
}) {
  const t = useTranslations("overview");
  const byPoints = buckets.some((b) => b.points > 0);
  const value = (bucket: Bucket) => (byPoints ? bucket.points : bucket.cards);
  const total = buckets.reduce((sum, bucket) => sum + value(bucket), 0);
  const inkOf = (bucket: Bucket, index: number) =>
    bucket.key === "none"
      ? "var(--chart-5)"
      : bucket.color
        ? themeSwatch(bucket.color)
        : BUCKET_PALETTE[index % BUCKET_PALETTE.length]!;
  const shareOf = (bucket: Bucket) => (total > 0 ? Math.round((value(bucket) / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-3">
      {total > 0 && (
        <div
          role="img"
          aria-label={buckets
            .filter((bucket) => value(bucket) > 0)
            .map((bucket) => `${name(bucket)} ${shareOf(bucket)} %`)
            .join(", ")}
          className="flex h-2.5 w-full gap-px overflow-hidden rounded-full"
        >
          {buckets.map(
            (bucket, index) =>
              value(bucket) > 0 && (
                <span
                  key={bucket.key}
                  title={`${name(bucket)} · ${shareOf(bucket)} %`}
                  style={{
                    width: `${(value(bucket) / total) * 100}%`,
                    background: inkOf(bucket, index),
                  }}
                />
              ),
          )}
        </div>
      )}
      <ol className="flex flex-col gap-1.5">
        {buckets.map((bucket, index) => (
          <li key={bucket.key} className="flex items-baseline gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 self-center rounded-full"
              style={{ background: inkOf(bucket, index) }}
            />
            <span className={cn("min-w-0 flex-1 truncate", bucket.key === "none" && "text-meta")}>
              {name(bucket)}
            </span>
            <span className="text-meta shrink-0 text-2sm tabular-nums">
              {t("bucketValue", {
                unit,
                cards: bucket.cards,
                points: bucket.points,
              })}
              {total > 0 && ` · ${shareOf(bucket)} %`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
