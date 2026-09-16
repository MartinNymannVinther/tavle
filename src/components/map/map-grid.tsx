"use client";

import type { Place } from "@/components/board/quick-add";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { MapCell } from "./map-cell";
import type { Release } from "@/core/db/schema";
import { FeatureNote, LooseHead, RowLabel } from "./map-headers";
import { cellKey, LOOSE_COLUMN, type MapRow, type StoryMap } from "./story-map";

/**
 * The map drawn as one CSS grid: the row labels down the left, the
 * backbone of feature notes across the top, the loose column last, and
 * a cell for every row and column. Rows are parted by a dashed line —
 * a release slice, in Patton's words — and every other column is a
 * shade darker so the eye can follow a feature down.
 */
export type Drag = { kind: "card" | "feature"; id: string } | null;

export type GridHandlers = {
  drag: Drag;
  setDrag: (drag: Drag) => void;
  /** A card dropped in a cell. */
  onDropCard: (row: MapRow, columnKey: string) => void;
  /** A feature note dropped before another, or at the end when `beforeId` is null. */
  onDropFeature: (beforeId: string | null) => void;
  onNudgeFeature: (featureId: string, delta: -1 | 1) => void;
  onTakeDown: (featureId: string) => void;
  onAdd: (row: MapRow, place: Place, title: string) => Promise<boolean>;
  featureTotals: (featureId: string) => { total: number; done: number; open: number };
  /** The row's cards whose feature is off the backbone, offered from the label. */
  hiddenOf: (rowKey: string) => Array<{ card: CardView; featureId: string; featureTitle: string }>;
  onReveal: (featureId: string) => void;
  /** Every card in a band, drawn or not, so its count is the release's own. */
  bandOf: (rowKey: string) => CardView[];
  /** Opens a band for renaming and dating. */
  onEditRelease: (release: Release) => void;
  /** Moves a band one step nearer or further. */
  onNudgeRelease: (release: Release, delta: -1 | 1) => void;
};

export function MapGrid({
  map,
  boardId,
  structure,
  doneIds,
  handlers,
}: {
  map: StoryMap;
  boardId: string;
  structure: StructureLookup;
  doneIds: Set<string>;
  handlers: GridHandlers;
}) {
  const { drag } = handlers;
  const cardId = drag?.kind === "card" ? drag.id : null;
  const featureDrag = drag?.kind === "feature";
  const features = map.columns.filter((column) => column.feature !== null);
  const cellsOf = (row: MapRow, columnKey: string): CardView[] =>
    map.cells.get(cellKey(row.key, columnKey)) ?? [];
  const looseCount = map.rows.reduce((sum, row) => sum + cellsOf(row, LOOSE_COLUMN).length, 0);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-full"
        style={{
          gridTemplateColumns: `11rem repeat(${map.columns.length}, minmax(15rem, 1fr))`,
        }}
      >
        <div className="bg-card sticky left-0 z-10" />
        {map.columns.map((column, index) =>
          column.feature ? (
            <FeatureNote
              key={column.key}
              feature={column.feature}
              boardId={boardId}
              structure={structure}
              progress={handlers.featureTotals(column.feature.id)}
              tilt={index % 2 === 0 ? -1 : 1}
              dragging={featureDrag && drag.id === column.feature.id}
              onDragStart={() => handlers.setDrag({ kind: "feature", id: column.feature!.id })}
              onDragEnd={() => handlers.setDrag(null)}
              onDropBefore={() => handlers.onDropFeature(column.feature!.id)}
              onNudge={{
                left: index > 0 ? () => handlers.onNudgeFeature(column.feature!.id, -1) : undefined,
                right:
                  index < features.length - 1
                    ? () => handlers.onNudgeFeature(column.feature!.id, 1)
                    : undefined,
              }}
              onTakeDown={() => handlers.onTakeDown(column.feature!.id)}
              canDrop={featureDrag && drag.id !== column.feature.id}
            />
          ) : (
            <LooseHead
              key={column.key}
              count={looseCount}
              canDrop={featureDrag}
              onDropAtEnd={() => handlers.onDropFeature(null)}
            />
          ),
        )}
        {map.rows.map((row, rowIndex) => {
          // A band's weight is the whole release, not only what the
          // backbone happens to draw: the row label names the release, so
          // the number beside it has to be the release's own.
          const rowCards = handlers.bandOf(row.key);
          // The nearest release is the one the team is working toward.
          const active = row.kind === "release" && rowIndex === 0;
          return (
            <div
              key={row.key}
              className={cn(
                "contents",
                rowIndex > 0 && "[&>*]:border-input [&>*]:border-t [&>*]:border-dashed",
              )}
            >
              <RowLabel
                row={row}
                cards={rowCards.length}
                points={rowCards.reduce((sum, card) => sum + (card.estimate ?? 0), 0)}
                unit={structure.estimateUnit}
                hidden={handlers.hiddenOf(row.key)}
                onEdit={handlers.onEditRelease}
                onNudge={
                  row.kind === "release"
                    ? {
                        up:
                          rowIndex > 0 ? () => handlers.onNudgeRelease(row.release, -1) : undefined,
                        // The unreleased band is always last, so a release
                        // can go down only while another release is below it.
                        down:
                          rowIndex < map.rows.length - 2
                            ? () => handlers.onNudgeRelease(row.release, 1)
                            : undefined,
                      }
                    : undefined
                }
                onReveal={handlers.onReveal}
              />
              {map.columns.map((column, index) => (
                <MapCell
                  key={column.key}
                  cards={cellsOf(row, column.key)}
                  boardId={boardId}
                  structure={structure}
                  doneIds={doneIds}
                  active={active}
                  band={index % 2 === 1}
                  fixed={column.feature ? { featureId: column.feature.id } : undefined}
                  dragId={cardId}
                  setDragId={(id) => handlers.setDrag(id ? { kind: "card", id } : null)}
                  onDrop={() => handlers.onDropCard(row, column.key)}
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
