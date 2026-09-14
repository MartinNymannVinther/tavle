"use client";

import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import type { Run } from "@/components/board/use-board-actions";
import type { Sprint } from "@/core/db/schema";
import { planFeatureAction } from "@/modules/boards/actions-sprints";
import type { ItemView } from "@/modules/boards/types";

/**
 * The feature's planned span, wherever the feature is worked on: two
 * sprint selects, start and target (docs/adr/0023). Choosing "no plan"
 * on either clears both; a lone end means one sprint; the service swaps
 * a span drawn backwards and carries the reverse for Fortryd.
 */
export function FeaturePlanFields({
  item,
  sprints,
  run,
}: {
  item: ItemView;
  sprints: Sprint[];
  run: Run;
}) {
  const t = useTranslations("boards.structure");
  // Open sprints, plus whatever the plan already names, so an old plan stays legible.
  const axis = sprints
    .filter(
      (s) => s.state !== "closed" || s.id === item.startSprintId || s.id === item.targetSprintId,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (axis.length === 0) return null;
  const plan = (startSprintId: string | null, targetSprintId: string | null) =>
    void run(() => planFeatureAction({ itemId: item.id, startSprintId, targetSprintId }));
  const select = (value: string | null, label: string, onPick: (id: string | null) => void) => (
    <NativeSelect
      variant="xs"
      value={value ?? ""}
      onChange={(event) => onPick(event.target.value || null)}
      aria-label={label}
      className="w-fit"
    >
      <option value="">{t("noPlan")}</option>
      {axis.map((sprint) => (
        <option key={sprint.id} value={sprint.id}>
          {sprint.name}
        </option>
      ))}
    </NativeSelect>
  );
  return (
    <span className="flex flex-wrap items-center gap-1">
      {select(item.startSprintId, t("planStart", { title: item.title }), (id) =>
        plan(id, id ? item.targetSprintId : null),
      )}
      <span className="text-meta text-[0.72rem]">–</span>
      {select(item.targetSprintId, t("planTarget", { title: item.title }), (id) =>
        plan(id ? item.startSprintId : null, id),
      )}
    </span>
  );
}
