"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { Sprint } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";

/**
 * What happens to the stories ticked in the backlog: on a Scrum board
 * they go into one of the open sprints, and on any board they go under
 * one feature in one gesture. The bar is there only while something is
 * selected, so the header stays quiet the rest of the time.
 */
export function SelectionBar({
  count,
  scrum,
  sprints,
  target,
  onTarget,
  onCommit,
  features,
  onPlace,
  onClear,
}: {
  count: number;
  scrum: boolean;
  /** Empty on a Kanban board: there is nothing to commit to. */
  sprints: Sprint[];
  target: string;
  onTarget: (sprintId: string) => void;
  onCommit: () => void;
  /** The open features a ticked card can be put under. */
  features: ItemView[];
  onPlace: (featureId: string | null) => void;
  onClear: () => void;
}) {
  const t = useTranslations("backlog");
  const [featureId, setFeatureId] = useState("");
  if (count === 0) return null;
  return (
    <div className="bg-accent text-accent-foreground mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-2sm font-medium">
      <span className="tabular-nums">{t("selected", { count })}</span>
      <span className="flex-1" />
      {features.length > 0 && (
        <>
          <NativeSelect
            variant="sm"
            value={featureId}
            onChange={(event) => setFeatureId(event.target.value)}
            aria-label={t("placeTarget")}
            className="h-8 w-44"
          >
            <option value="">{t("noParentOption")}</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.title}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="h-8"
            onClick={() => onPlace(featureId || null)}
          >
            {t("place")}
          </Button>
        </>
      )}
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
      ) : scrum ? (
        <span className="text-accent-foreground/80 text-2sm">{t("noSprint")}</span>
      ) : null}
      <Button type="button" variant="ghost" size="xs" className="h-8" onClick={onClear}>
        {t("clearSelection")}
      </Button>
    </div>
  );
}
