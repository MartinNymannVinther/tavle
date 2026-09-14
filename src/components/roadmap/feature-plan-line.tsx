"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { themeSwatch } from "@/components/board/tokens";
import { TypeIcon } from "@/components/board/type-icon";
import type { Sprint, Theme } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** What a drag or a select settles: the feature's whole span on the sprint axis. */
export type PlanFeatureSpan = (
  featureId: string,
  startSprintId: string,
  targetSprintId: string,
) => void;

type Drag = { mode: "move" | "start" | "end"; from: number; cell: number; delta: number };

/**
 * One feature on the sprint axis (docs/adr/0023) — the same bar the
 * epics have on the quarters: drag the middle to move the span, an edge
 * to change the duration, or use the two selects; one write on release.
 */
export function FeaturePlanLine({
  feature,
  theme,
  sprints,
  currentId,
  boardId,
  boardKey,
  crumb,
  onPlan,
}: {
  feature: ItemView;
  theme: Theme | null;
  sprints: Sprint[];
  currentId: string | null;
  boardId: string;
  boardKey: string;
  /** The epic's key, said once under the title. */
  crumb: string | null;
  onPlan: PlanFeatureSpan;
}) {
  const t = useTranslations("roadmap");
  const [drag, setDrag] = useState<Drag | null>(null);
  const index = (sprintId: string | null) => sprints.findIndex((s) => s.id === sprintId);
  const start = Math.max(0, index(feature.startSprintId));
  const end = Math.max(start, index(feature.targetSprintId));
  const last = sprints.length - 1;

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
      event.stopPropagation();
      const strip = event.currentTarget.closest("[data-strip]") as HTMLElement;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        mode,
        from: event.clientX,
        cell: strip.getBoundingClientRect().width / sprints.length,
        delta: 0,
      });
    };
  }

  function move(event: React.PointerEvent) {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.from) / drag.cell);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  }

  function up() {
    if (!drag) return;
    setDrag(null);
    if (span.start !== start || span.end !== end) {
      onPlan(feature.id, sprints[span.start]!.id, sprints[span.end]!.id);
    }
  }

  return (
    <div className="grid items-center" style={{ gridTemplateColumns: "16rem minmax(0, 1fr)" }}>
      <div className="flex min-w-0 items-start gap-2 px-4 py-2">
        <TypeIcon type="feature" className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/boards/${boardId}/items/${feature.number}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {feature.title}
          </Link>
          <p className="text-meta flex flex-wrap items-center gap-2 text-[0.69rem] tabular-nums">
            <span className="font-mono">
              {boardKey}-{feature.number}
            </span>
            {crumb && <span>{crumb}</span>}
          </p>
          <p className="flex flex-wrap items-center gap-1">
            <SprintSelect
              value={sprints[span.start]!.id}
              sprints={sprints}
              label={t("planStart", { title: feature.title })}
              onChange={(sprintId) => onPlan(feature.id, sprintId, sprints[span.end]!.id)}
            />
            <span className="text-meta text-[0.69rem]">–</span>
            <SprintSelect
              value={sprints[span.end]!.id}
              sprints={sprints}
              label={t("planQuarter", { title: feature.title })}
              onChange={(sprintId) => onPlan(feature.id, sprints[span.start]!.id, sprintId)}
            />
          </p>
        </div>
      </div>
      <div className="relative h-12" data-strip onPointerMove={move} onPointerUp={up}>
        <div
          aria-hidden
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${sprints.length}, minmax(0, 1fr))` }}
        >
          {sprints.map((sprint) => (
            <div
              key={sprint.id}
              className={cn(
                "border-hairline border-l",
                sprint.id === currentId && "bg-secondary/40",
              )}
            />
          ))}
        </div>
        <div
          onPointerDown={down("move")}
          className={cn(
            "absolute inset-y-3 flex cursor-grab touch-none items-center overflow-hidden rounded-md px-2 text-[0.69rem] font-medium text-white select-none active:cursor-grabbing",
            drag && "ring-primary ring-2",
          )}
          style={{
            left: `calc(${(span.start / sprints.length) * 100}% + 0.25rem)`,
            width: `calc(${((span.end - span.start + 1) / sprints.length) * 100}% - 0.5rem)`,
            background: theme ? themeSwatch(theme.color) : "var(--label)",
          }}
          title={`${sprints[span.start]!.name} – ${sprints[span.end]!.name}`}
        >
          <span className="relative truncate">{feature.title}</span>
        </div>
        <PlanEdge
          onPointerDown={down("start")}
          left={(span.start / sprints.length) * 100}
          shift="+ 0.25rem"
        />
        <PlanEdge
          onPointerDown={down("end")}
          left={((span.end + 1) / sprints.length) * 100}
          shift="- 0.25rem"
        />
      </div>
    </div>
  );
}

function PlanEdge({
  onPointerDown,
  left,
  shift,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  left: number;
  shift: string;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="group/handle absolute inset-y-2 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
      style={{ left: `calc(${left}% ${shift})` }}
      aria-hidden
    >
      <span className="bg-foreground/35 h-5 w-1 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100" />
    </div>
  );
}

/** A sprint chosen by name: the path that needs no pointer, and the way in for the unplanned. */
export function SprintSelect({
  value,
  sprints,
  label,
  onChange,
  allowNone,
}: {
  value: string;
  sprints: Sprint[];
  label: string;
  onChange: (sprintId: string) => void;
  allowNone?: { word: string };
}) {
  return (
    <NativeSelect
      variant="sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="h-6 w-fit text-[0.69rem]"
    >
      {allowNone && <option value="">{allowNone.word}</option>}
      {sprints.map((sprint) => (
        <option key={sprint.id} value={sprint.id}>
          {sprint.name}
        </option>
      ))}
    </NativeSelect>
  );
}
