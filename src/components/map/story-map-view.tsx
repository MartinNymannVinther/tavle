"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownUp } from "lucide-react";
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
import { FullscreenButton, useFullscreen } from "@/components/board/use-fullscreen";
import { Button } from "@/components/ui/button";
import type { BoardFull } from "@/modules/boards/types";
import { createCardAction, placeCardAction } from "@/modules/boards/actions-cards";
import { reorderReleaseAction, setCardsReleaseAction } from "@/modules/boards/actions-releases";
import { alignBacklogToMapAction, placeOnMapAction } from "@/modules/boards/actions-structure";
import { cn } from "@/lib/utils";
import type { Release } from "@/core/db/schema";
import { MapGrid, type Drag } from "./map-grid";
import { ReleaseForm } from "./release-form";
import { MapTray } from "./map-tray";
import {
  backbone,
  featureTotals,
  LOOSE_COLUMN,
  rowOf,
  storyMap,
  tray,
  type MapRow,
} from "./story-map";

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
  const [showDone, setShowDone] = useState(true);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [drag, setDrag] = useState<Drag>(null);
  const screen = useFullscreen();
  // One dialog serves every band: null means a new one.
  const [editing, setEditing] = useState<{ open: boolean; release: Release | null }>({
    open: false,
    release: null,
  });

  const doneColumns = new Set(full.columns.filter((c) => c.category === "done").map((c) => c.id));
  const isDone = (card: { columnId: string }) => doneColumns.has(card.columnId);
  const filtered = applyFilters(full.cards, filters, board.key);
  // Finished work can be taken off the wall: after a few months the cells
  // are mostly strikethrough, and what is left is the interesting part.
  // Everything downstream — the cells, the row counts, the off-map
  // notice — reads this one list, so they cannot disagree.
  const cards = showDone ? filtered : filtered.filter((card) => !isDone(card));
  const doneShown = filtered.filter(isDone).length;
  const map = storyMap(full, structure.items, cards, { showClosed });
  const onMap = backbone(structure.items, { showClosed });
  // The server orders the whole lane, hidden closed features included, so
  // every index sent up is a position in that lane, not in the view.
  const wholeLane = backbone(structure.items, { showClosed: true });
  // Closed features still standing on the wall: what the tick reveals.
  const closedOnMap = wholeLane.filter((f) => f.state === "closed").length;
  const waiting = tray(structure.items, { showClosed });
  // A card whose feature the wall is not drawing is invisible in the
  // cells while still counted in its band; the row label offers every one
  // of them, and says which of the two reasons it is. A feature waiting
  // in the tray goes up; a closed one is behind the tick above. Nothing
  // is reassigned either way.
  const drawnFeatureIds = new Set(onMap.map((f) => f.id));
  const onWallIds = new Set(wholeLane.map((f) => f.id));
  const featureOf = (featureId: string | null) =>
    featureId
      ? structure.items.find((i) => i.id === featureId && i.level === "feature")
      : undefined;
  const hiddenOf = (rowKey: string) =>
    cards.flatMap((card) => {
      if (rowOf(card, map.rows) !== rowKey) return [];
      const feature = featureOf(card.featureId);
      // No feature at all is drawn in the dashed column, so it is not hidden.
      if (!feature || drawnFeatureIds.has(feature.id)) return [];
      // Standing on the wall and merely hidden by the tick is one thing;
      // waiting in the tray is another. Reading it from the wall rather
      // than from the feature's state means one pick always does what
      // the person asked, whichever of the two it is.
      const reason = onWallIds.has(feature.id) ? "closed" : "tray";
      return [{ card, featureId: feature.id, featureTitle: feature.title, reason } as const];
    });
  const doneIds = new Set(full.cards.filter(isDone).map((c) => c.id));
  const countOf = (featureId: string) => full.cards.filter((c) => c.featureId === featureId).length;
  // The wall and the rank answer different questions, so differing is
  // allowed — but worth a glance. The notice says so; the button is the
  // one-way offer to let the backlog follow the map.
  const rankOrder = [...onMap].sort((a, b) => a.sort - b.sort || a.number - b.number);
  const drifted =
    onMap.length > 1 && onMap.some((feature, index) => feature.id !== rankOrder[index]!.id);

  /** A card's drop is at most two moves: a new feature, and a new release. */
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
    const releaseId = row.kind === "release" ? row.release.id : null;
    if (releaseId !== card.releaseId) {
      await run(() => setCardsReleaseAction({ cardIds: [id], releaseId }));
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
        releaseId: row.kind === "release" ? row.release.id : undefined,
      }),
    );

  return (
    <section
      className={cn(
        "border-border bg-card @container flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]",
        // The wall is the one surface that wants the whole window.
        screen.fullscreen && "fixed inset-4 z-40 overflow-auto",
      )}
    >
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing({ open: true, release: null })}
        >
          {t("release.new")}
        </Button>
        <FullscreenButton fullscreen={screen.fullscreen} onToggle={screen.toggle} />
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
          people={full.people}
          structure={structure}
        />
        {/* A board with nothing closed on the wall says so, rather than
            offering a tick that cannot change anything. */}
        <label
          className="text-meta flex items-center gap-1.5 text-2sm has-disabled:opacity-50"
          title={closedOnMap === 0 ? t("noClosed") : undefined}
        >
          <input
            type="checkbox"
            checked={showClosed}
            disabled={closedOnMap === 0}
            onChange={(event) => setShowClosed(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          {t("showClosedFeatures", { count: closedOnMap })}
        </label>
        <label
          className="text-meta flex items-center gap-1.5 text-2sm has-disabled:opacity-50"
          title={doneShown === 0 ? t("noDone") : undefined}
        >
          <input
            type="checkbox"
            checked={showDone}
            disabled={doneShown === 0 && showDone}
            onChange={(event) => setShowDone(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          {t("showDoneCards", { count: doneShown })}
        </label>
      </div>
      {onMap.length === 0 && (
        <p className="text-meta border-hairline border-b px-4 py-6 text-center text-sm">
          {waiting.length > 0 ? t("emptyTray") : t("empty")}
        </p>
      )}
      {drifted && (
        <p className="text-meta border-hairline flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-2sm">
          <ArrowDownUp className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{t("orderDrift")}</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void run(() => alignBacklogToMapAction({ boardId: board.id }))}
          >
            {t("alignBacklog")}
          </Button>
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
          hiddenOf,
          bandOf: (rowKey) => cards.filter((card) => rowOf(card, map.rows) === rowKey),
          onEditRelease: (release) => setEditing({ open: true, release }),
          onNudgeRelease: (release, delta) => {
            const order = [...full.releases].sort(
              (a, b) => a.sort - b.sort || a.createdAt.getTime() - b.createdAt.getTime(),
            );
            const at = order.findIndex((r) => r.id === release.id);
            const index = at + delta;
            if (at < 0 || index < 0 || index >= order.length) return;
            void run(() => reorderReleaseAction({ releaseId: release.id, index }));
          },
          onReveal: (featureId, reason) => {
            if (reason === "closed") {
              setShowClosed(true);
              return;
            }
            // A closed feature put back up is drawn only while the tick
            // is on, so the pick turns it on as well: one answer to one
            // question.
            if (featureOf(featureId)?.state === "closed") setShowClosed(true);
            void run(() => placeOnMapAction({ itemId: featureId }));
          },
        }}
      />
      <ReleaseForm
        key={editing.release?.id ?? "new"}
        boardId={board.id}
        release={editing.release}
        open={editing.open}
        onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}
        run={run}
      />
      <div className="border-hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-2">
        <TypeLegend types={legendTypes(view)} />
        {view.themes && <ThemeLegend themes={structure.themes} />}
      </div>
    </section>
  );
}
