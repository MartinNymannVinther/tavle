"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createCardAction, moveCardAction } from "@/modules/boards/actions-cards";
import type { BoardFull, CardView } from "@/modules/boards/types";
import { placeInLane } from "@/modules/boards/ordering";
import { Link } from "@/i18n/navigation";
import { BoardColumn, type DropTarget } from "./board-column";
import { applyFilters, BoardFilters, NO_FILTERS, type Filters } from "./board-filters";
import { structureOf } from "./card-chips";
import type { Place } from "./quick-add";
import { SprintHeader } from "./sprint-header";
import { ThemeLegend, TypeLegend } from "./type-legend";
import { useBoardActions } from "./use-board-actions";

/**
 * The board. Columns side by side, cards in each, dragged or moved by
 * menu. A move is applied to the local copy first and rolled back if the
 * server says no, so the board feels like a board and not like a form.
 * The local copy is re-seeded whenever the server sends fresh cards.
 */
export function BoardView({ full, today }: { full: BoardFull; today: string }) {
  const t = useTranslations("boards.view");
  const { run } = useBoardActions();
  const [seed, setSeed] = useState(full.cards);
  const [cards, setCards] = useState(full.cards);
  if (seed !== full.cards) {
    // React's "adjust state on props" pattern: fresh rows from the server
    // replace the optimistic copy during render, without an effect.
    setSeed(full.cards);
    setCards(full.cards);
  }
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const { board, columns, members, activeSprint } = full;
  const structure = structureOf(full);
  const scrum = board.mode === "scrum";
  const onBoard = scrum ? cards.filter((c) => c.sprintId === activeSprint?.id) : cards;
  const visible = applyFilters(onBoard, filters);
  const planned = full.sprints.filter((s) => s.state === "planned");

  function lane(columnId: string): CardView[] {
    return onBoard
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => a.sort - b.sort || a.number - b.number);
  }

  function moveLocally(cardId: string, columnId: string, index: number | undefined) {
    setCards((current) => {
      const card = current.find((c) => c.id === cardId);
      if (!card) return current;
      const target = current
        .filter((c) => c.columnId === columnId && c.id !== cardId && c.sprintId === card.sprintId)
        .sort((a, b) => a.sort - b.sort || a.number - b.number);
      const changes = new Map(placeInLane(target, cardId, index).map((c) => [c.id, c.sort]));
      const column = columns.find((c) => c.id === columnId);
      return current.map((c) => {
        if (c.id === cardId) {
          return {
            ...c,
            columnId,
            sort: changes.get(c.id) ?? c.sort,
            doneAt: column?.category === "done" ? (c.doneAt ?? new Date()) : null,
          };
        }
        return changes.has(c.id) ? { ...c, sort: changes.get(c.id)! } : c;
      });
    });
  }

  async function move(cardId: string, columnId: string, index?: number) {
    const before = cards;
    moveLocally(cardId, columnId, index);
    const ok = await run(() => moveCardAction({ cardId, columnId, index }));
    if (!ok) setCards(before);
  }

  function onDrop(columnId: string, index: number) {
    const id = dragId;
    setDragId(null);
    setDropTarget(null);
    if (!id) return;
    // An index counted among the visible cards is also an index among the
    // lane's cards unless a filter hides some; then the end is the honest
    // place, and the person can drag again with the filter cleared.
    const filtered = visible.length !== onBoard.length;
    void move(id, columnId, filtered ? undefined : index);
  }

  async function add(columnId: string, title: string, place: Place) {
    return run(() =>
      createCardAction({
        boardId: board.id,
        title,
        columnId,
        sprintId: activeSprint?.id ?? null,
        ...place,
      }),
    );
  }

  if (scrum && !activeSprint) {
    return (
      <EmptyState
        title={t("noSprintTitle")}
        hint={t("noSprintBody")}
        action={
          <Link href={`/boards/${board.id}/backlog`} className={buttonVariants({ size: "sm" })}>
            {t("noSprintCta")}
          </Link>
        }
      />
    );
  }

  const donePoints = onBoard
    .filter((c) => columns.find((col) => col.id === c.columnId)?.category === "done")
    .reduce((total, c) => total + (c.estimate ?? 0), 0);
  const totalPoints = onBoard.reduce((total, c) => total + (c.estimate ?? 0), 0);
  const doneCards = onBoard.filter(
    (c) => columns.find((col) => col.id === c.columnId)?.category === "done",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {scrum && activeSprint && (
        <SprintHeader
          sprint={activeSprint}
          planned={planned}
          boardId={board.id}
          today={today}
          donePoints={donePoints}
          totalPoints={totalPoints}
          doneCards={doneCards}
          totalCards={onBoard.length}
          run={run}
        />
      )}
      <BoardFilters
        filters={filters}
        onChange={setFilters}
        members={members}
        structure={structure}
      />
      <div className="-mx-5 overflow-x-auto px-5 pb-4 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8">
        <div
          className="flex items-start gap-3"
          style={{ minWidth: `${columns.length * 17.75}rem` }}
        >
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              cards={applyFilters(lane(column.id), filters)}
              boardKey={board.key}
              boardId={board.id}
              structure={structure}
              columns={columns}
              today={today}
              dragId={dragId}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
              onDragStart={setDragId}
              onDragEnd={() => {
                setDragId(null);
                setDropTarget(null);
              }}
              onDrop={onDrop}
              onMove={(cardId, columnId, index) => void move(cardId, columnId, index)}
              onAdd={add}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <TypeLegend types={["feature", "bug", "enabler"]} />
        <ThemeLegend themes={structure.themes} />
      </div>
    </div>
  );
}
