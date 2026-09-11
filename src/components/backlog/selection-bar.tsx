"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { Sprint } from "@/core/db/schema";

/**
 * What happens to the stories ticked in the backlog: they go into one
 * of the open sprints. The bar is there only while something is
 * selected, so the header stays quiet the rest of the time.
 */
export function SelectionBar({
  count,
  sprints,
  target,
  onTarget,
  onCommit,
  onClear,
}: {
  count: number;
  sprints: Sprint[];
  target: string;
  onTarget: (sprintId: string) => void;
  onCommit: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("backlog");
  if (count === 0) return null;
  return (
    <div className="bg-accent text-accent-foreground mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] font-medium">
      <span className="tabular-nums">{t("selected", { count })}</span>
      <span className="flex-1" />
      {sprints.length > 0 ? (
        <>
          <NativeSelect
            variant="sm"
            value={target}
            onChange={(event) => onTarget(event.target.value)}
            aria-label={t("targetSprint")}
            className="h-8 w-40"
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" size="xs" className="h-8" onClick={onCommit}>
            {t("commit")}
          </Button>
        </>
      ) : (
        <span className="text-accent-foreground/80 text-[0.78rem]">{t("noSprint")}</span>
      )}
      <Button type="button" variant="ghost" size="xs" className="h-8" onClick={onClear}>
        {t("clearSelection")}
      </Button>
    </div>
  );
}
