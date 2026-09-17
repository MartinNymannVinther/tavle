"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Run } from "@/components/board/use-board-actions";
import { isBareDecomposition } from "@/modules/ai/bare-backlog";
import type { StructureView } from "@/modules/boards/structure/view";
import type { BoardFull, CardView } from "@/modules/boards/types";
import { selectionKey, type Selection } from "./backlog-selection";
import { AssistDialog } from "./assist-dialog";
import { BootstrapDialog } from "./bootstrap-dialog";
import { ItemForm } from "./item-form";

/**
 * The backlog's own header: the count and the two ways to grow the
 * decomposition. "New feature" starts under the epic the navigator has
 * chosen, so the place a person is looking at is the place the new
 * thing lands.
 */
export function BacklogHeader({
  full,
  view,
  all,
  selection,
  run,
  follow,
  aiAvailable,
}: {
  full: BoardFull;
  view: StructureView;
  all: CardView[];
  selection: Selection;
  run: Run;
  follow: (level: "epic" | "feature") => (item: { id: string; parentId: string | null }) => void;
  aiAvailable: boolean;
}) {
  const t = useTranslations("backlog");
  return (
    <header className="border-hairline flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-meta text-sm tabular-nums">
          {t("holds", {
            unit: full.board.estimateUnit,
            cards: all.length,
            points: all.reduce((total, c) => total + (c.estimate ?? 0), 0),
          })}
        </p>
      </div>
      {/* One slot, two offers: a starting point while the backlog is bare,
          the assistant once the team has built one (docs/adr/0037). */}
      {view.features &&
        (isBareDecomposition(full.items) ? (
          <BootstrapDialog boardId={full.board.id} run={run} available={aiAvailable} />
        ) : (
          <AssistDialog boardId={full.board.id} run={run} available={aiAvailable} />
        ))}
      {view.epics && (
        <ItemForm
          full={full}
          level="epic"
          run={run}
          onCreated={follow("epic")}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {t("newEpic")}
            </Button>
          }
        />
      )}
      {view.features && (
        <ItemForm
          key={selectionKey(selection)}
          full={full}
          level="feature"
          parentId={selection.kind === "epic" ? selection.id : undefined}
          run={run}
          onCreated={follow("feature")}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {t("newFeature")}
            </Button>
          }
        />
      )}
    </header>
  );
}
