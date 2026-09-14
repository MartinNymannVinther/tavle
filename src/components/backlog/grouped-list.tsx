"use client";

import { useTranslations } from "next-intl";
import type { ChipContext } from "@/components/board/card-chips";
import { themeSwatch } from "@/components/board/tokens";
import { StoryRows, type StoryRowProps } from "./backlog-list";
import type { Group } from "./group-backlog";

/**
 * The backlog grouped by one field: a heading per value, in the same
 * voice as an epic's, with the stories under it. A story in two themes
 * is under both; the counts say so.
 */
export function GroupedList({
  groups,
  rows,
  contextOf,
}: {
  groups: Group[];
  rows: StoryRowProps;
  /** What the heading already says of a story's place, so the row leaves it out. */
  contextOf: (group: Group) => ChipContext | undefined;
}) {
  const t = useTranslations("backlog.hierarchy");
  return (
    <ol className="border-hairline divide-hairline divide-y border-t">
      {groups.map((group) => (
        <li key={group.key}>
          <p className="bg-secondary/60 flex items-center gap-2 px-3 py-2.5">
            {group.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: themeSwatch(group.color) }}
              />
            )}
            <span className="text-reading font-semibold">{group.name}</span>
            <span className="text-meta text-xs tabular-nums">
              {t("groupCount", { count: group.stories.length })}
            </span>
          </p>
          {group.stories.length > 0 ? (
            <StoryRows stories={group.stories} rows={rows} context={contextOf(group)} />
          ) : (
            <p className="text-meta px-3 py-2 text-2sm">{t("groupEmpty")}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
