"use client";

import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import type { Run } from "@/components/board/use-board-actions";
import { quarterOptions } from "@/components/backlog/quarters";
import { updateItemAction } from "@/modules/boards/actions-structure";
import type { RoadmapRow } from "@/modules/boards/structure/roadmap";

/**
 * The plan as controls rather than as a drag (docs/adr/0019). The bar is
 * the quick path; these are the ones a keyboard, a screen reader and a
 * phone can reach, and the only way to take a start quarter back off
 * again — a drag can only ever write a concrete one.
 */

type Epic = RoadmapRow["epic"];

/** This quarter and the next eleven, plus whatever the epic already holds. */
function optionsFor(quarter: string | null): string[] {
  const ahead = quarterOptions();
  return quarter && !ahead.includes(quarter) ? [quarter, ...ahead] : ahead;
}

/** The unplanned list's way onto the roadmap: choose a target, keep the derived start. */
export function QuarterSelect({ epic, run }: { epic: Epic; run: Run }) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  if (epic.state !== "open") return null;
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
      className="h-7 w-fit text-xs"
    >
      <option value="">{s("noQuarter")}</option>
      {optionsFor(epic.targetQuarter).map((quarter) => (
        <option key={quarter} value={quarter}>
          {quarter}
        </option>
      ))}
    </NativeSelect>
  );
}

/**
 * Both ends of a planned epic's span, under its title on the roadmap.
 * An empty start means the epic starts where it was created, which is
 * what the bar draws when nothing has been said.
 */
export function SpanSelects({ epic, run }: { epic: Epic; run: Run }) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  if (epic.state !== "open") return null;
  return (
    <span
      className={
        // Out of the way until the row is touched, but always in the tab
        // order: focus brings it back into view.
        "flex items-center gap-1 [@media(hover:hover)]:opacity-0 " +
        "[@media(hover:hover)]:group-hover/row:opacity-100 " +
        "[@media(hover:hover)]:has-[:focus-visible]:opacity-100"
      }
    >
      <NativeSelect
        variant="xs"
        value={epic.startQuarter ?? ""}
        onChange={(event) =>
          void run(() =>
            updateItemAction({ itemId: epic.id, startQuarter: event.target.value || null }),
          )
        }
        aria-label={t("startQuarterFor", { title: epic.title })}
        className="h-6 w-fit text-2xs"
      >
        <option value="">{t("noStartQuarter")}</option>
        {optionsFor(epic.startQuarter).map((quarter) => (
          <option key={quarter} value={quarter}>
            {quarter}
          </option>
        ))}
      </NativeSelect>
      <span aria-hidden className="text-meta text-2xs">
        –
      </span>
      <NativeSelect
        variant="xs"
        value={epic.targetQuarter ?? ""}
        onChange={(event) =>
          void run(() =>
            updateItemAction({ itemId: epic.id, targetQuarter: event.target.value || null }),
          )
        }
        aria-label={t("planQuarter", { title: epic.title })}
        className="h-6 w-fit text-2xs"
      >
        <option value="">{s("noQuarter")}</option>
        {optionsFor(epic.targetQuarter).map((quarter) => (
          <option key={quarter} value={quarter}>
            {quarter}
          </option>
        ))}
      </NativeSelect>
    </span>
  );
}
