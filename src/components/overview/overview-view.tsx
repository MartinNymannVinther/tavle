"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { themeSwatch } from "@/components/board/tokens";
import { overview, type Bucket } from "@/modules/boards/structure/overview";
import { structureView } from "@/modules/boards/structure/view";
import type { BoardFull } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The overview: where the open work sits, by theme, by area and by kind,
 * the enabler share as one number, and the five health measures that
 * say whether the structure is being kept. Bars are rows with a length,
 * because a row can carry a name and a number and a bar chart cannot.
 */
export function OverviewView({ full }: { full: BoardFull }) {
  const t = useTranslations("overview");
  const s = useTranslations("boards.structure");
  const data = overview(full);
  const view = structureView(full.board);
  const percent = (value: number) => `${Math.round(value * 100)} %`;
  const share = (part: number, total: number) => (total > 0 ? percent(part / total) : "–");
  const tile = (label: string, value: string, hint: string, warn = false) => (
    <div key={label} className="flex flex-col gap-0.5">
      <p className="text-label text-[0.72rem] font-medium">{label}</p>
      <p
        className={cn(
          "text-[1.375rem] leading-none font-semibold tabular-nums",
          warn && "text-warning",
        )}
      >
        {value}
      </p>
      <p className="text-meta text-[0.72rem]">{hint}</p>
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
        data.openPoints > 0 ? t("byPoints") : t("byCards"),
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
                <span className="text-meta mr-2 text-[0.72rem] tabular-nums">
                  {full.board.key}-{epic.number}
                </span>
                <Link
                  href={`/boards/${full.board.id}/items/${epic.number}`}
                  className="font-medium hover:underline"
                >
                  {epic.title}
                </Link>
                <span className="text-warning ml-2 text-[0.72rem] font-medium">
                  {s("forReview")}
                </span>
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
                {t("distributionBody", { cards: data.openCards, points: data.openPoints })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Bars buckets={buckets} name={name} total={data.openPoints || data.openCards} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Bars({
  buckets,
  name,
  total,
}: {
  buckets: Bucket[];
  name: (bucket: Bucket) => string;
  total: number;
}) {
  const t = useTranslations("overview");
  const byPoints = buckets.some((b) => b.points > 0);
  const max = Math.max(1, ...buckets.map((b) => (byPoints ? b.points : b.cards)));
  return (
    <ol className="flex flex-col gap-2.5">
      {buckets.map((bucket) => {
        const value = byPoints ? bucket.points : bucket.cards;
        return (
          <li key={bucket.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("truncate", bucket.key === "none" && "text-meta")}>
                {name(bucket)}
              </span>
              <span className="text-meta shrink-0 text-[0.78rem] tabular-nums">
                {t("bucketValue", { cards: bucket.cards, points: bucket.points })}
                {total > 0 && ` · ${Math.round((value / total) * 100)} %`}
              </span>
            </div>
            <div className="bg-hairline h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(value / max) * 100}%`,
                  background: bucket.color ? themeSwatch(bucket.color) : "var(--primary)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
