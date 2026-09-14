"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedChoice } from "@/components/ui/segmented";
import { StatusChip, ThemeChip } from "@/components/board/bits";
import { TypeIcon } from "@/components/board/type-icon";
import { TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { ItemForm } from "@/components/backlog/item-form";
import { updateItemAction } from "@/modules/boards/actions-structure";
import { roadmap } from "@/modules/boards/structure/roadmap";
import type { RoadmapRow } from "@/modules/boards/structure/roadmap";
import { structureView } from "@/modules/boards/structure/view";
import { useFolded } from "@/components/backlog/use-folded";
import { RoadmapChildren } from "./roadmap-children";
import { FeaturePlan } from "./feature-plan";
import { QuarterSelect, RoadmapLine, type PlanSpan } from "./roadmap-line";
import type { BoardFull } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The roadmap: epics as bars across quarters, coloured by their first
 * theme, filtered by area. Drawn as a table of rows with a bar in each,
 * not as one SVG, so every title is a link, the page reads on a phone
 * and a screen reader gets a list rather than a picture. An epic due
 * for review says so on its bar; an epic with no target quarter is
 * listed underneath as unplanned rather than drawn to nowhere. The
 * backlog can be built from here too: a new epic from the header or
 * from a quarter's own "+", and every open epic's quarter is a select
 * on its row, so planning is a change here rather than a trip away.
 */
export function RoadmapView({ full }: { full: BoardFull }) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  const { run } = useBoardActions();
  const scrum = full.board.mode === "scrum";
  const view = structureView(full.board);
  // Two ways of looking at time: the epics on quarters, the features on
  // sprints (docs/adr/0023). Scrum boards have both; Kanban has no
  // sprints to plan against yet. A board that hides epics but shows
  // features opens straight on the sprint axis.
  const [axis, setAxis] = useState<"epics" | "features">(view.epics ? "epics" : "features");
  const [areaId, setAreaId] = useState("");
  // Its own fold memory, apart from the backlog's: two pages, two looks.
  const folded = useFolded(`${full.board.id}:roadmap`);
  // A dragged bar lands where it was dropped, before the server answers;
  // fresh rows from the server clear the overrides.
  const [seed, setSeed] = useState(full.items);
  const [plans, setPlans] = useState<Map<string, { start: string; target: string }>>(new Map());
  if (seed !== full.items) {
    setSeed(full.items);
    setPlans(new Map());
  }
  const plan: PlanSpan = (epicId, startQuarter, targetQuarter) => {
    setPlans((prev) => new Map(prev).set(epicId, { start: startQuarter, target: targetQuarter }));
    void run(() => updateItemAction({ itemId: epicId, startQuarter, targetQuarter })).then((ok) => {
      if (!ok) {
        setPlans((prev) => {
          const next = new Map(prev);
          next.delete(epicId);
          return next;
        });
      }
    });
  };
  const data = roadmap(full);
  const planned = (row: RoadmapRow): RoadmapRow => {
    const override = plans.get(row.epic.id);
    return override ? { ...row, startQuarter: override.start, endQuarter: override.target } : row;
  };
  const rows = (areaId ? data.rows.filter((r) => r.epic.areaId === areaId) : data.rows).map(
    planned,
  );
  const unplanned = areaId
    ? data.unplanned.filter((r) => r.epic.areaId === areaId)
    : data.unplanned;
  const areas = view.areas ? full.areas.filter((a) => a.active) : [];
  const columns = data.quarters.length;
  const themesUsed = view.themes
    ? [...new Set(rows.map((r) => r.theme?.id).filter(Boolean))].map((id) =>
        full.themes.find((theme) => theme.id === id)!,
      )
    : [];

  if (!view.epics) {
    // On a Scrum board the sprint axis stands on its own even when the
    // board hides epics (docs/adr/0023); Kanban has no axis without them.
    if (!scrum) return <p className="text-meta text-sm">{t("noEpics")}</p>;
    return <FeaturePlan full={full} />;
  }

  const toggle = scrum && (
    <SegmentedChoice
      value={axis}
      onChange={setAxis}
      label={t("axisLabel")}
      options={[
        { value: "epics", label: t("axisEpics") },
        { value: "features", label: t("axisFeatures") },
      ]}
      className="w-fit"
    />
  );

  if (axis === "features") {
    return (
      <div className="flex flex-col gap-4">
        {toggle}
        <FeaturePlan full={full} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {toggle}
        {areas.length > 1 && (
          <NativeSelect
            variant="sm"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            aria-label={t("areaFilter")}
            className="w-44"
          >
            <option value="">{t("allAreas")}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {themesUsed.map((theme) => (
            <ThemeChip key={theme.id} theme={theme} />
          ))}
        </div>
        <span className="flex-1" />
        <ItemForm
          full={full}
          level="epic"
          run={run}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {t("newEpic")}
            </Button>
          }
        />
      </div>

      <section className="border-border bg-card overflow-x-auto rounded-xl border shadow-[var(--surface-shadow)]">
        <div className="min-w-[44rem]">
          <div
            className="border-hairline grid border-b"
            style={{ gridTemplateColumns: `16rem repeat(${columns}, minmax(0, 1fr))` }}
          >
            <div className="text-label px-4 py-2 text-xs font-medium">{t("epic")}</div>
            {data.quarters.map((quarter) => (
              <div
                key={quarter}
                className={cn(
                  "border-hairline group/quarter flex items-center justify-center gap-1 border-l px-2 py-2 text-center text-xs font-medium tabular-nums",
                  quarter === data.current ? "text-foreground bg-secondary/60" : "text-label",
                )}
              >
                {quarter}
                {quarter >= data.current && (
                  <ItemForm
                    full={full}
                    level="epic"
                    targetQuarter={quarter}
                    run={run}
                    trigger={
                      <button
                        type="button"
                        aria-label={t("addInQuarter", { quarter })}
                        title={t("addInQuarter", { quarter })}
                        className="text-meta hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/quarter:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-meta px-4 py-6 text-sm">{t("empty")}</p>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={row.epic.id} className="border-hairline border-b last:border-b-0">
                  <RoadmapLine
                    row={row}
                    quarters={data.quarters}
                    current={data.current}
                    boardId={full.board.id}
                    boardKey={full.board.key}
                    onPlan={plan}
                    fold={{
                      open: folded.isOpen(row.epic.id),
                      onToggle: () => folded.toggle(row.epic.id),
                    }}
                  />
                  {folded.isOpen(row.epic.id) && (
                    <RoadmapChildren epicId={row.epic.id} full={full} quarters={data.quarters} />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {unplanned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("unplanned", { count: unplanned.length })}</h2>
          <p className="text-meta text-sm">{t("unplannedHint")}</p>
          <ul className="border-hairline divide-hairline divide-y rounded-lg border">
            {unplanned.map((row) => (
              <li key={row.epic.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <TypeIcon type="epic" />
                <span className="text-meta font-mono shrink-0 text-xs tabular-nums">
                  {full.board.key}-{row.epic.number}
                </span>
                <Link
                  href={`/boards/${full.board.id}/items/${row.epic.number}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {row.epic.title}
                </Link>
                {row.reviewDue && <StatusChip tone="warning">{s("forReview")}</StatusChip>}
                <QuarterSelect epic={row.epic} run={run} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <TypeLegend types={["epic"]} />
    </div>
  );
}
