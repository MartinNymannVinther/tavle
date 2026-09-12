"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ItemForm } from "@/components/backlog/item-form";
import { useFolded } from "@/components/backlog/use-folded";
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
import { setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { MapGrid } from "./map-grid";
import { LOOSE_COLUMN, storyMap, type MapRow } from "./story-map";

/**
 * The story map: the decomposition across, the plan down, and every
 * card in the one cell where those two meet. Dragging a card sideways
 * moves it to another feature; dragging it down or up moves it to
 * another sprint (or column). Nothing here is a new fact about the
 * board — the map is the backlog and the sprints seen from above — so
 * what a person does on it is what they could do on the backlog page,
 * only in one motion.
 */
export function StoryMapView({ full }: { full: BoardFull }) {
  const t = useTranslations("map");
  const b = useTranslations("backlog");
  const { run } = useBoardActions();
  const { board } = full;
  const scrum = board.mode === "scrum";
  const structure = structureOf(full);
  const { view } = structure;
  // The map opens with every epic unfolded; the set remembers the folded ones.
  const folded = useFolded(`${board.id}.map`);
  const [showClosed, setShowClosed] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [dragId, setDragId] = useState<string | null>(null);

  const cards = applyFilters(full.cards, filters);
  const map = storyMap(full, view, structure.items, cards, { showClosed });
  const doneColumns = new Set(full.columns.filter((c) => c.category === "done").map((c) => c.id));
  const doneIds = new Set(full.cards.filter((c) => doneColumns.has(c.columnId)).map((c) => c.id));
  const empty = structure.items.length === 0 && full.cards.length === 0;

  /** A drop is at most two moves: a new feature, and a new sprint or column. */
  async function drop(row: MapRow, columnKey: string) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const card = full.cards.find((c) => c.id === id);
    if (!card) return;
    const featureId = columnKey.startsWith("fold:")
      ? undefined
      : columnKey === LOOSE_COLUMN
        ? null
        : columnKey;
    if (featureId !== undefined && featureId !== card.featureId) {
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
        {view.epics && (
          <ItemForm
            full={full}
            level="epic"
            run={run}
            trigger={
              <Button type="button" variant="outline" size="sm">
                {b("newEpic")}
              </Button>
            }
          />
        )}
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
      <div className="border-hairline flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <BoardFilters
          filters={filters}
          onChange={setFilters}
          members={full.members}
          structure={structure}
        />
        <label className="text-meta flex items-center gap-1.5 text-[0.78rem]">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(event) => setShowClosed(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          {b("nav.showClosed")}
        </label>
      </div>
      {empty ? (
        <p className="text-meta px-4 py-10 text-center text-sm">{t("empty")}</p>
      ) : (
        <MapGrid
          map={map}
          full={full}
          structure={structure}
          doneIds={doneIds}
          run={run}
          handlers={{
            isFolded: (epicId) => folded.isOpen(epicId),
            toggleFold: folded.toggle,
            dragId,
            setDragId,
            onDrop: (row, columnKey) => void drop(row, columnKey),
            onAdd: add,
          }}
        />
      )}
      <div className="border-hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-2">
        <TypeLegend types={legendTypes(view)} />
        {view.themes && <ThemeLegend themes={structure.themes} />}
      </div>
    </section>
  );
}
