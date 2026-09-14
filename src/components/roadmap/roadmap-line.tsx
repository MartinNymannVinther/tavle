"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { themeSwatch } from "@/components/board/tokens";
import { TypeIcon } from "@/components/board/type-icon";
import type { Run } from "@/components/board/use-board-actions";
import { FoldButton } from "@/components/backlog/backlog-bits";
import { quarterOptions } from "@/components/backlog/quarters";
import { updateItemAction } from "@/modules/boards/actions-structure";
import type { RoadmapRow } from "@/modules/boards/structure/roadmap";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** What a drag or a select settles: the epic's whole span. */
export type PlanSpan = (epicId: string, startQuarter: string, targetQuarter: string) => void;

/**
 * One epic on the roadmap. The bar is the plan and the plan is the
 * bar's to change: dragging its middle moves the whole span, dragging
 * an edge changes the duration, and the two selects under the title do
 * the same without a pointer — because every move also exists as a
 * control. The preview follows the pointer in whole quarters; the
 * write happens once, on release.
 */
type Drag = { mode: "move" | "start" | "end"; from: number; cell: number; delta: number };

export function RoadmapLine({
  row,
  quarters,
  current,
  boardId,
  boardKey,
  onPlan,
  fold,
}: {
  row: RoadmapRow;
  quarters: string[];
  current: string;
  boardId: string;
  boardKey: string;
  onPlan: PlanSpan;
  /** Folds the epic's features and cards out underneath. */
  fold?: { open: boolean; onToggle: () => void };
}) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = Math.max(0, quarters.indexOf(row.startQuarter));
  const end = Math.max(start, quarters.indexOf(row.endQuarter));
  const closed = row.epic.state === "closed";
  const planned = row.epic.state === "open" && Boolean(row.epic.targetQuarter);
  const total = row.openStories + row.doneStories;
  const progress = total > 0 ? row.doneStories / total : 0;
  const last = quarters.length - 1;

  // The preview during a drag, clamped to the quarters on screen.
  const span = (() => {
    if (!drag) return { start, end };
    if (drag.mode === "move") {
      const d = Math.max(-start, Math.min(drag.delta, last - end));
      return { start: start + d, end: end + d };
    }
    if (drag.mode === "start") {
      return { start: Math.max(0, Math.min(start + drag.delta, end)), end };
    }
    return { start, end: Math.min(last, Math.max(end + drag.delta, start)) };
  })();

  function down(mode: Drag["mode"]) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      if (!planned) return;
      event.stopPropagation();
      const strip = event.currentTarget.closest("[data-strip]") as HTMLElement;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        mode,
        from: event.clientX,
        cell: strip.getBoundingClientRect().width / quarters.length,
        delta: 0,
      });
    };
  }

  function move(event: React.PointerEvent) {
    if (!drag) return;
    // A drag the browser took over must never keep steering the bar
    // into a later click.
    if (event.buttons === 0) {
      setDrag(null);
      return;
    }
    const delta = Math.round((event.clientX - drag.from) / drag.cell);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  }

  function up() {
    if (!drag) return;
    setDrag(null);
    if (span.start !== start || span.end !== end) {
      onPlan(row.epic.id, quarters[span.start]!, quarters[span.end]!);
    }
  }

  return (
    <div className="grid items-center" style={{ gridTemplateColumns: "16rem minmax(0, 1fr)" }}>
      <div className="flex min-w-0 items-start gap-2 px-4 py-2">
        {fold && <FoldButton open={fold.open} onToggle={fold.onToggle} />}
        <TypeIcon type="epic" className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/boards/${boardId}/items/${row.epic.number}`}
            className={cn("truncate text-sm font-medium hover:underline", closed && "text-meta")}
          >
            {row.epic.title}
          </Link>
          <p className="text-meta flex flex-wrap items-center gap-2 text-[0.69rem] tabular-nums">
            <span className="font-mono">
              {boardKey}-{row.epic.number}
            </span>
            {row.theme && <span>{row.theme.name}</span>}
            <span>{t("counts", { features: row.features, done: row.doneStories, total })}</span>
          </p>
          {planned && (
            <SpanSelects
              epic={row.epic}
              startQuarter={quarters[span.start]!}
              targetQuarter={quarters[span.end]!}
              onPlan={onPlan}
            />
          )}
        </div>
      </div>
      <div
        className="relative h-12"
        data-strip
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
      >
        <div
          aria-hidden
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${quarters.length}, minmax(0, 1fr))` }}
        >
          {quarters.map((quarter) => (
            <div
              key={quarter}
              className={cn("border-hairline border-l", quarter === current && "bg-secondary/40")}
            />
          ))}
        </div>
        <div
          onPointerDown={down("move")}
          className={cn(
            "absolute inset-y-3 flex items-center overflow-hidden rounded-md px-2 text-[0.69rem] font-medium text-white select-none",
            closed && "opacity-60",
            planned && "cursor-grab touch-none active:cursor-grabbing",
            drag && "ring-primary ring-2",
          )}
          style={{
            left: `calc(${(span.start / quarters.length) * 100}% + 0.25rem)`,
            width: `calc(${((span.end - span.start + 1) / quarters.length) * 100}% - 0.5rem)`,
            background: row.theme ? themeSwatch(row.theme.color) : "var(--label)",
          }}
          title={`${quarters[span.start]} – ${quarters[span.end]}`}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-white/25"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <span className="relative truncate">
            {closed
              ? t("closed")
              : row.reviewDue
                ? `${row.epic.title} · ${s("forReview")}`
                : row.epic.title}
          </span>
        </div>
        {planned && (
          <>
            <EdgeHandle
              onPointerDown={down("start")}
              left={`calc(${(span.start / quarters.length) * 100}% + 0.25rem)`}
            />
            <EdgeHandle
              onPointerDown={down("end")}
              left={`calc(${((span.end + 1) / quarters.length) * 100}% - 0.25rem)`}
            />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A duration handle on the bar's edge. A sibling of the bar rather than
 * a child, so the bar's rounded clipping cannot swallow it: a wide,
 * centred hit area straddling the edge, with a grip that shows itself
 * on hover.
 */
function EdgeHandle({
  onPointerDown,
  left,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  left: string;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="group/handle absolute inset-y-2 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
      style={{ left }}
      aria-hidden
    >
      <span className="bg-foreground/35 h-5 w-1 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100" />
    </div>
  );
}

/** The span as two selects: the path that needs no pointer. */
function SpanSelects({
  epic,
  startQuarter,
  targetQuarter,
  onPlan,
}: {
  epic: RoadmapRow["epic"];
  startQuarter: string;
  targetQuarter: string;
  onPlan: PlanSpan;
}) {
  const t = useTranslations("roadmap");
  const options = (extra: string) => [
    ...(quarterOptions().includes(extra) ? [] : [extra]),
    ...quarterOptions(),
  ];
  return (
    <p className="flex flex-wrap items-center gap-1">
      <NativeSelect
        variant="sm"
        value={startQuarter}
        onChange={(event) => onPlan(epic.id, event.target.value, targetQuarter)}
        aria-label={t("planStart", { title: epic.title })}
        className="h-6 w-fit text-[0.69rem]"
      >
        {options(startQuarter).map((quarter) => (
          <option key={quarter} value={quarter}>
            {quarter}
          </option>
        ))}
      </NativeSelect>
      <span className="text-meta text-[0.69rem]">–</span>
      <NativeSelect
        variant="sm"
        value={targetQuarter}
        onChange={(event) => onPlan(epic.id, startQuarter, event.target.value)}
        aria-label={t("planQuarter", { title: epic.title })}
        className="h-6 w-fit text-[0.69rem]"
      >
        {options(targetQuarter).map((quarter) => (
          <option key={quarter} value={quarter}>
            {quarter}
          </option>
        ))}
      </NativeSelect>
    </p>
  );
}

/** The unplanned list's way onto the roadmap: choose a target, keep the derived start. */
export function QuarterSelect({ epic, run }: { epic: RoadmapRow["epic"]; run: Run }) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  if (epic.state !== "open") return null;
  const options = [
    ...(epic.targetQuarter && !quarterOptions().includes(epic.targetQuarter)
      ? [epic.targetQuarter]
      : []),
    ...quarterOptions(),
  ];
  return (
    <NativeSelect
      variant="sm"
      value={epic.targetQuarter ?? ""}
      onChange={(event) =>
        void run(() =>
          updateItemAction({ itemId: epic.id, targetQuarter: event.target.value || null }),
        )
      }
      aria-label={t("planQuarter", { title: epic.title })}
      className="h-7 w-fit text-[0.72rem]"
    >
      <option value="">{s("noQuarter")}</option>
      {options.map((quarter) => (
        <option key={quarter} value={quarter}>
          {quarter}
        </option>
      ))}
    </NativeSelect>
  );
}
