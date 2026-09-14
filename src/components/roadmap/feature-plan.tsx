"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { TypeIcon } from "@/components/board/type-icon";
import { useBoardActions } from "@/components/board/use-board-actions";
import { createSprintSeriesAction, planFeatureAction } from "@/modules/boards/actions-sprints";
import { todayInCopenhagen } from "@/core/dates";
import type { BoardFull, ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { FeaturePlanLine, SprintSelect } from "./feature-plan-line";

/**
 * The roadmap's feature view (docs/adr/0023): the sprints as columns —
 * running and planned, laid ahead with one button — and the features as
 * bars across them, dragged like the epics' quarters. Unplanned
 * features wait underneath with a way in. The plan is a marker; it
 * commits no card to anything.
 */
export function FeaturePlan({ full }: { full: BoardFull }) {
  const t = useTranslations("roadmap");
  const { run } = useBoardActions();
  const { board } = full;
  const [count, setCount] = useState("4");
  // A dragged bar lands where dropped before the server answers.
  const [seed, setSeed] = useState(full.items);
  const [plans, setPlans] = useState<Map<string, { start: string; target: string }>>(new Map());
  if (seed !== full.items) {
    setSeed(full.items);
    setPlans(new Map());
  }

  const today = todayInCopenhagen();
  const axis = full.sprints
    .filter((s) => s.state !== "closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const currentId = full.sprints.find((s) => s.state === "active")?.id ?? null;
  const themeOf = (feature: ItemView) =>
    feature.themeIds[0] ? (full.themes.find((th) => th.id === feature.themeIds[0]) ?? null) : null;
  const crumbOf = (feature: ItemView) => {
    const epic = feature.parentId ? full.items.find((i) => i.id === feature.parentId) : null;
    return epic ? `${board.key}-${epic.number} · ${epic.title}` : null;
  };
  const axisIds = new Set(axis.map((s) => s.id));
  const withPlan = (feature: ItemView): ItemView => {
    const override = plans.get(feature.id);
    return override
      ? { ...feature, startSprintId: override.start, targetSprintId: override.target }
      : feature;
  };
  const features = full.items
    .filter((i) => i.level === "feature" && i.state === "open")
    .sort((a, b) => a.sort - b.sort || a.number - b.number)
    .map(withPlan);
  const planned = features.filter((f) => f.targetSprintId && axisIds.has(f.targetSprintId));
  const unplanned = features.filter((f) => !f.targetSprintId || !axisIds.has(f.targetSprintId));

  const plan = (featureId: string, startSprintId: string, targetSprintId: string) => {
    setPlans((prev) =>
      new Map(prev).set(featureId, { start: startSprintId, target: targetSprintId }),
    );
    void run(() => planFeatureAction({ itemId: featureId, startSprintId, targetSprintId })).then(
      (ok) => {
        if (!ok) {
          setPlans((prev) => {
            const next = new Map(prev);
            next.delete(featureId);
            return next;
          });
        }
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1" />
        <NativeSelect
          variant="sm"
          value={count}
          onChange={(event) => setCount(event.target.value)}
          aria-label={t("seriesCount")}
          className="w-fit"
        >
          {[2, 4, 6, 8].map((n) => (
            <option key={n} value={n}>
              {t("seriesOption", { count: n, weeks: (n * board.sprintLengthDays) / 7 })}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void run(() => createSprintSeriesAction({ boardId: board.id, count: Number(count) }))
          }
        >
          <Plus data-slot="icon" />
          {t("createSeries")}
        </Button>
      </div>

      {axis.length === 0 ? (
        <p className="text-meta text-sm">{t("noSprints")}</p>
      ) : (
        <section className="border-border bg-card overflow-x-auto rounded-xl border shadow-[var(--surface-shadow)]">
          <div className="min-w-[44rem]">
            <div
              className="border-hairline grid border-b"
              style={{ gridTemplateColumns: `16rem repeat(${axis.length}, minmax(0, 1fr))` }}
            >
              <div className="text-label px-4 py-2 text-[0.72rem] font-medium">
                {t("featureColumn")}
              </div>
              {axis.map((sprint) => (
                <div
                  key={sprint.id}
                  className={cn(
                    "border-hairline border-l px-2 py-2 text-center text-[0.72rem] font-medium",
                    sprint.id === currentId
                      ? "text-foreground bg-secondary/60"
                      : sprint.endDate < today
                        ? "text-meta"
                        : "text-label",
                  )}
                  title={`${sprint.startDate} – ${sprint.endDate}`}
                >
                  {sprint.name}
                </div>
              ))}
            </div>
            {planned.length === 0 ? (
              <p className="text-meta px-4 py-6 text-sm">{t("noPlanned")}</p>
            ) : (
              <ol className="divide-hairline divide-y">
                {planned.map((feature) => (
                  <li key={feature.id}>
                    <FeaturePlanLine
                      feature={feature}
                      theme={themeOf(feature)}
                      sprints={axis}
                      currentId={currentId}
                      boardId={board.id}
                      boardKey={board.key}
                      crumb={crumbOf(feature)}
                      onPlan={plan}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {unplanned.length > 0 && axis.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">
            {t("unplannedFeatures", { count: unplanned.length })}
          </h2>
          <ul className="border-hairline divide-hairline divide-y rounded-lg border">
            {unplanned.map((feature) => (
              <li key={feature.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <TypeIcon type="feature" />
                <span className="text-meta font-mono shrink-0 text-[0.72rem] tabular-nums">
                  {board.key}-{feature.number}
                </span>
                <Link
                  href={`/boards/${board.id}/items/${feature.number}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {feature.title}
                </Link>
                <SprintSelect
                  value=""
                  sprints={axis}
                  label={t("planQuarter", { title: feature.title })}
                  allowNone={{ word: t("unplannedWord") }}
                  onChange={(sprintId) => {
                    if (sprintId) plan(feature.id, sprintId, sprintId);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
