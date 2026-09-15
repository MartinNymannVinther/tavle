"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChipContext } from "@/components/board/card-chips";
import { themeSwatch } from "@/components/board/tokens";
import { cn } from "@/lib/utils";
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
  groupDropOf,
}: {
  groups: Group[];
  rows: StoryRowProps;
  /** What the heading already says of a story's place, so the row leaves it out. */
  contextOf: (group: Group) => ChipContext | undefined;
  /** A drop into this group assigns its field; undefined for the groups that cannot take one. */
  groupDropOf?: (
    group: Group,
  ) => { onDrop: (cardId: string, siblingId: string | null, after: boolean) => void } | undefined;
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
            <StoryRows
              stories={group.stories}
              rows={rows}
              context={contextOf(group)}
              groupDrop={groupDropOf?.(group)}
            />
          ) : (
            <EmptyGroupSlot
              text={t("groupEmpty")}
              dragId={rows.dragId}
              onClear={() => rows.setDragId(null)}
              drop={groupDropOf?.(group)}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/** The empty group still takes a drop: the card arrives as its first. */
function EmptyGroupSlot({
  text,
  dragId,
  onClear,
  drop,
}: {
  text: string;
  dragId: string | null;
  onClear: () => void;
  drop?: { onDrop: (cardId: string, siblingId: string | null, after: boolean) => void };
}) {
  const [over, setOver] = useState(false);
  return (
    <p
      onDragOver={(event) => {
        if (!drop || !dragId) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        if (drop && dragId) {
          drop.onDrop(dragId, null, false);
          onClear();
        }
        setOver(false);
      }}
      className={cn("text-meta px-3 py-2 text-2sm", over && "bg-accent/60")}
    >
      {text}
    </p>
  );
}
