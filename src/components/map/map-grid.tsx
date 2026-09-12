"use client";

import { useTranslations } from "next-intl";
import { ItemForm } from "@/components/backlog/item-form";
import type { Place } from "@/components/board/quick-add";
import type { StructureLookup } from "@/components/board/card-chips";
import type { Run } from "@/components/board/use-board-actions";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";
import { MapCell } from "./map-cell";
import { EpicHead, FeatureHead, LooseHead, RowLabel } from "./map-headers";
import { cellKey, featureTotals, type MapRow, type StoryMap } from "./story-map";

/**
 * The map drawn as one CSS grid: the row labels down the left, the
 * epic heads over their features, the feature heads over their
 * columns, the loose column last, and a cell for every row and column.
 * Folded epics take one column and their cells say only how many.
 */
export type GridHandlers = {
  isFolded: (epicId: string) => boolean;
  toggleFold: (epicId: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (row: MapRow, columnKey: string) => void;
  onAdd: (row: MapRow, place: Place, title: string) => Promise<boolean>;
};

const FOLD = (epicId: string) => `fold:${epicId}`;

export function MapGrid({
  map,
  full,
  structure,
  doneIds,
  run,
  handlers,
}: {
  map: StoryMap;
  full: BoardFull;
  structure: StructureLookup;
  doneIds: Set<string>;
  run: Run;
  handlers: GridHandlers;
}) {
  const t = useTranslations("backlog");
  const m = useTranslations("map");
  const { board } = full;
  const { view } = structure;

  // A folded epic is one column; its cells hold every card of its features.
  const columns = map.groups.flatMap((group) =>
    group.epic && handlers.isFolded(group.epic.id)
      ? [{ key: FOLD(group.epic.id), feature: null, folded: true, group }]
      : group.columns.map((column) => ({ ...column, folded: false, group })),
  );
  const cellsOf = (row: MapRow, column: (typeof columns)[number]): CardView[] =>
    column.folded
      ? column.group.columns.flatMap((c) => map.cells.get(cellKey(row.key, c.key)) ?? [])
      : (map.cells.get(cellKey(row.key, column.key)) ?? []);
  const epicTotals = (epic: ItemView) =>
    full.items
      .filter((item) => item.parentId === epic.id)
      .map((feature) => featureTotals(feature, full))
      .reduce(
        (sum, p) => ({
          total: sum.total + p.total,
          done: sum.done + p.done,
          open: sum.open + p.open,
        }),
        { total: 0, done: 0, open: 0 },
      );
  const looseCount = map.rows.reduce(
    (sum, row) => sum + (map.cells.get(cellKey(row.key, "loose"))?.length ?? 0),
    0,
  );

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-full"
        style={{
          gridTemplateColumns: `10rem repeat(${columns.length}, minmax(13rem, 1fr))`,
        }}
      >
        {view.epics && (
          <>
            <div className="bg-card border-border sticky left-0 z-10 border-r border-b" />
            {map.groups.map((group) =>
              group.loose ? (
                <LooseHead key={group.key} count={looseCount} epicRow />
              ) : group.epic ? (
                <EpicHead
                  key={group.key}
                  epic={group.epic}
                  boardId={board.id}
                  structure={structure}
                  reviewDays={board.epicReviewDays}
                  progress={epicTotals(group.epic)}
                  folded={handlers.isFolded(group.epic.id)}
                  onFold={() => handlers.toggleFold(group.epic!.id)}
                  span={handlers.isFolded(group.epic.id) ? 1 : Math.max(1, group.columns.length)}
                  action={
                    group.epic.state === "open" ? (
                      <ItemForm
                        full={full}
                        level="feature"
                        parentId={group.epic.id}
                        run={run}
                        trigger={
                          <button
                            type="button"
                            className="text-meta hover:text-foreground font-medium"
                          >
                            + {t("newFeature")}
                          </button>
                        }
                      />
                    ) : undefined
                  }
                />
              ) : (
                <div
                  key={group.key}
                  className="border-hairline text-meta border-r border-b px-2 py-2 text-[0.72rem]"
                  style={{ gridColumn: `span ${group.columns.length}` }}
                >
                  {m("noEpic")}
                </div>
              ),
            )}
          </>
        )}
        <div className="bg-card border-border sticky left-0 z-10 border-r border-b" />
        {columns.map((column) =>
          column.group.loose ? (
            view.epics ? null : (
              <LooseHead key={column.key} count={looseCount} epicRow={false} />
            )
          ) : column.folded ? (
            <div
              key={column.key}
              className="bg-secondary border-hairline text-meta border-r border-b px-2 py-2 text-[0.72rem]"
            >
              {m("foldedFeatures", { count: column.group.columns.length })}
            </div>
          ) : (
            <FeatureHead
              key={column.key}
              feature={column.feature!}
              boardId={board.id}
              structure={structure}
              progress={featureTotals(column.feature!, full)}
            />
          ),
        )}
        {map.rows.map((row) => {
          const rowCards = columns.flatMap((column) => cellsOf(row, column));
          return (
            <div key={row.key} className="contents">
              <RowLabel
                row={row}
                cards={rowCards.length}
                points={rowCards.reduce((sum, card) => sum + (card.estimate ?? 0), 0)}
              />
              {columns.map((column) => (
                <MapCell
                  key={column.key}
                  cards={cellsOf(row, column)}
                  boardId={board.id}
                  structure={structure}
                  doneIds={doneIds}
                  active={row.kind === "sprint" && row.sprint.state === "active"}
                  folded={column.folded}
                  fixed={column.feature ? { featureId: column.feature.id } : undefined}
                  dragId={handlers.dragId}
                  setDragId={handlers.setDragId}
                  onDrop={() => handlers.onDrop(row, column.key)}
                  onAdd={(title, place) => handlers.onAdd(row, place, title)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
