"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ItemForm } from "@/components/backlog/item-form";
import {
  applyFilters,
  BoardFilters,
  NO_FILTERS,
  type Filters,
} from "@/components/board/board-filters";
import { structureOf } from "@/components/board/card-chips";
import type { Place } from "@/components/board/quick-add";
import { legendTypes, ThemeLegend, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { Button } from "@/components/ui/button";
import type { BoardFull } from "@/modules/boards/types";
import { createCardAction, moveCardAction, placeCardAction } from "@/modules/boards/actions-cards";
import { placeOnMapAction } from "@/modules/boards/actions-structure";
import { setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { MapGrid, type Drag } from "./map-grid";
import { MapTray } from "./map-tray";
import { backbone, featureTotals, LOOSE_COLUMN, storyMap, tray, type MapRow } from "./story-map";

/**
 * The story map: the backbone of features across, in the story's
 * order, the plan down, and every card in the one cell where those two
 * meet. The backbone is the team's to build — a feature goes up from
 * the tray, is dragged or nudged into its place, and comes down from
 * its menu. Dragging a card sideways moves it to another feature; up
 * or down moves it to another sprint (or column). Every move is the
 * same write the backlog page would make, only in one motion.
 */
export function StoryMapView({ full }: { full: BoardFull }) {
  const t = useTranslations("map");
  const b = useTranslations("backlog");
  const { run } = useBoardActions();
  const { board } = full;
  const scrum = board.mode === "scrum";
  const structure = structureOf(full);
  const { view } = structure;
  const [showClosed, setShowClosed] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [drag, setDrag] = useState<Drag>(null);

  const cards = applyFilters(full.cards, filters);
  const map = storyMap(full, structure.items, cards, { showClosed });
  const onMap = backbone(structure.items, { showClosed });
  // The server orders the whole lane, hidden closed features included, so
  // every index sent up is a position in that lane, not in the view.
  const wholeLane = backbone(structure.items, { showClosed: true });
  const waiting = tray(structure.items);
  const doneColumns = new Set(full.columns.filter((c) => c.category === "done").map((c) => c.id));
  const doneIds = new Set(full.cards.filter((c) => doneColumns.has(c.columnId)).map((c) => c.id));
  const countOf = (featureId: string) => full.cards.filter((c) => c.featureId === featureId).length;

  /** A card's drop is at most two moves: a new feature, and a new sprint or column. */
  async function dropCard(row: MapRow, columnKey: string) {
    const id = drag?.kind === "card" ? drag.id : null;
    setDrag(null);
    if (!id) return;
    const card = full.cards.find((c) => c.id === id);
    if (!card) return;
    const featureId = columnKey === LOOSE_COLUMN ? null : columnKey;
    if (featureId !== card.featureId) {
      const ok = await run(() => placeCardAction({ cardId: id, featureId }));
      if (!ok) return;
    }
    if (row.kind === "sprint" && card.sprintId !== row.sprint.id) {
      await run(() => setCardsSprintAction({ cardIds: [id], sprintId: row.sprint.id }));
    } else if (row.kind === "backlog" && card.sprintId) {
      await run(() => setCardsSprintAction({ cardIds: [id], sprintId: null }));
    } else if (row.kind === "column" && card.columnId !== row.column.id) {
      await run(() => moveCardAction({ cardId: id, columnId: row.column.id }));
    }
  }

  /** The backbone's order is the map's own; a note lands before another, or at the end. */
  function dropFeature(beforeId: string | null) {
    const id = drag?.kind === "feature" ? drag.id : null;
    setDrag(null);
    if (!id || id === beforeId) return;
    const order = wholeLane.map((f) => f.id).filter((f) => f !== id);
    const index = beforeId ? order.indexOf(beforeId) : order.length;
    if (index < 0) return;
    void run(() => placeOnMapAction({ itemId: id, index }));
  }

  function nudgeFeature(featureId: string, delta: -1 | 1) {
    const visible = onMap.map((f) => f.id);
    const at = visible.indexOf(featureId);
    if (at < 0) return;
    // One step means past the visible neighbour, even when a hidden
    // closed feature sits between them in the lane.
    const neighbour = visible[at + delta];
    if (!neighbour) return;
    const order = wholeLane.map((f) => f.id).filter((f) => f !== featureId);
    const index = delta > 0 ? order.indexOf(neighbour) + 1 : order.indexOf(neighbour);
    if (index < 0) return;
    void run(() => placeOnMapAction({ itemId: featureId, index }));
  }

  const add = (row: MapRow, place: Place, title: string) =>
    run(() =>
      createCardAction({
        boardId: board.id,
        title,
        ...place,
        sprintId: row.kind === "sprint" ? row.sprint.id : undefined,
        columnId: row.kind === "column" ? row.column.id : undefined,
      }),
    );

  return (
    <section className="border-border bg-card @container flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="border-hairline flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-meta text-sm">{scrum ? t("leadScrum") : t("leadKanban")}</p>
        </div>
        <ItemForm
          full={full}
          level="feature"
          run={run}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {b("newFeature")}
            </Button>
          }
        />
      </header>
      <MapTray
        features={waiting}
        countOf={countOf}
        onPutUp={(featureId) => void run(() => placeOnMapAction({ itemId: featureId }))}
      />
      <div className="border-hairline flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <BoardFilters
          filters={filters}
          onChange={setFilters}
          members={full.members}
          structure={structure}
        />
        <label className="text-meta flex items-center gap-1.5 text-2sm">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(event) => setShowClosed(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          {b("nav.showClosed")}
        </label>
      </div>
      {onMap.length === 0 && (
        <p className="text-meta border-hairline border-b px-4 py-6 text-center text-sm">
          {waiting.length > 0 ? t("emptyTray") : t("empty")}
        </p>
      )}
      <MapGrid
        map={map}
        boardId={board.id}
        structure={structure}
        doneIds={doneIds}
        handlers={{
          drag,
          setDrag,
          onDropCard: (row, columnKey) => void dropCard(row, columnKey),
          onDropFeature: dropFeature,
          onNudgeFeature: nudgeFeature,
          onTakeDown: (featureId) =>
            void run(() => placeOnMapAction({ itemId: featureId, index: null })),
          onAdd: add,
          featureTotals: (featureId) =>
            featureTotals(
              full.items.find((item) => item.id === featureId)!,
              full,
            ),
        }}
      />
      <div className="border-hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-2">
        <TypeLegend types={legendTypes(view)} />
        {view.themes && <ThemeLegend themes={structure.themes} />}
      </div>
    </section>
  );
}
