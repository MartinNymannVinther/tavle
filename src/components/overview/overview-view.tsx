"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstimateUnit } from "@/core/db/schema";
import { themeSwatch } from "@/components/board/tokens";
import { overview, type Bucket } from "@/modules/boards/structure/overview";
import { structureView } from "@/modules/boards/structure/view";
import type { BoardFull } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
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
  const s = useTranslations("boards.structure");
  const data = overview(full);
  const view = structureView(full.board);
  const unit = (full.board.estimateUnit as EstimateUnit) ?? "points";
  const percent = (value: number) => `${Math.round(value * 100)} %`;
  const share = (part: number, total: number) => (total > 0 ? percent(part / total) : "–");
  const tile = (label: string, value: string, hint: string, warn = false) => (
    <div key={label} className="flex flex-col gap-0.5">
      <p className="text-label text-xs font-medium">{label}</p>
      <p
        className={cn(
          "text-[1.375rem] leading-none font-semibold tabular-nums",
          warn && "text-warning",
        )}
      >
        {value}
      </p>
      <p className="text-meta text-xs">{hint}</p>
    </div>
  );
  const idleThemes = view.themes ? data.health.idleThemes : [];
  const idleAreas = view.areas ? data.health.idleAreas : [];
  const reviewEpics = view.epics ? data.health.reviewEpics : [];
  const tiles = [
    view.features &&
      tile(
        t("parentless"),
        share(data.health.parentless.count, data.health.parentless.total),
        t("parentlessHint", data.health.parentless),
        data.health.parentless.count > 0,
      ),
    view.epics &&
      tile(
        t("review"),
        String(reviewEpics.length),
        t("reviewHint", { days: full.board.epicReviewDays }),
        reviewEpics.length > 0,
      ),
    view.areas &&
      tile(
        t("withoutArea"),
        share(data.health.withoutArea.count, data.health.withoutArea.total),
        t("withoutAreaHint", data.health.withoutArea),
        data.health.withoutArea.count > 0,
      ),
    view.kind &&
      tile(
        t("enablerShare"),
        data.openCards > 0 ? percent(data.enablerShare) : "–",
        data.openPoints > 0 ? t("byPoints", { unit }) : t("byCards"),
      ),
    (view.themes || view.areas) &&
      tile(
        t("idle"),
        String(idleThemes.length + idleAreas.length),
        t("idleHint"),
        idleThemes.length + idleAreas.length > 0,
      ),
  ].filter(Boolean);
  const distributions = (
    [
      ["byTheme", data.byTheme, view.themes],
      ["byArea", data.byArea, view.areas],
      ["byKind", data.byKind, view.kind],
    ] as const
  ).filter(([, , shown]) => shown);
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
          <CardTitle>{t("healthTitle")}</CardTitle>
          <CardDescription>{t("healthBody")}</CardDescription>
        </CardHeader>
        {tiles.length > 0 && (
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{tiles}</CardContent>
        )}
        {(reviewEpics.length > 0 || idleThemes.length > 0 || idleAreas.length > 0) && (
          <CardContent className="border-hairline flex flex-col gap-1 border-t pt-4 text-sm">
            {reviewEpics.map((epic) => (
              <p key={epic.id}>
                <span className="text-meta mr-2 text-xs tabular-nums">
                  {full.board.key}-{epic.number}
                </span>
                <Link
                  href={`/boards/${full.board.id}/items/${epic.number}`}
                  className="font-medium hover:underline"
                >
                  {epic.title}
                </Link>
                <span className="text-warning ml-2 text-xs font-medium">{s("forReview")}</span>
              </p>
            ))}
            {idleThemes.length > 0 && (
              <p className="text-meta">
                {t("idleThemes", { names: idleThemes.map((theme) => theme.name).join(", ") })}
              </p>
            )}
            {idleAreas.length > 0 && (
              <p className="text-meta">
                {t("idleAreas", { names: idleAreas.map((a) => a.name).join(", ") })}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {distributions.map(([key, buckets]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{t(`${key}Title`)}</CardTitle>
              <CardDescription>
                {t("distributionBody", { unit, cards: data.openCards, points: data.openPoints })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Distribution buckets={buckets} name={name} unit={unit} />
            </CardContent>
          </Card>
        ))}
      </div>
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
