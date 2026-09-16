"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityList } from "@/components/card/activity-list";
import { useBoardActions } from "@/components/board/use-board-actions";
import type { BoardEvent } from "@/core/db/schema";
import { undoEventAction } from "@/modules/boards/actions-undo";

/**
 * What has been changed about the board itself — its themes and areas,
 * its lanes, the levels and fields it shows, a release renamed, the
 * backlog told to follow the map. These changes belong to no card and
 * no epic, so the feeds on those pages never showed them, and the
 * reverse each of them carries (docs/adr/0022) could not be pressed by
 * anyone. This is that page: the same feed, the same Fortryd, for the
 * shape of the board.
 */
export function BoardActivity({ events }: { events: BoardEvent[] }) {
  const t = useTranslations("boardSettings.activity");
  const { run } = useBoardActions();
  if (events.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityList
          heading={null}
          events={events}
          onUndo={(eventId) => void run(() => undoEventAction({ eventId }))}
        />
      </CardContent>
    </Card>
  );
}
