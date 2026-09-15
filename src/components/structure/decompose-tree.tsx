"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FoldButton } from "@/components/backlog/backlog-bits";
import { useFolded } from "@/components/backlog/use-folded";
import { QuickAdd } from "@/components/board/quick-add";
import { TypeIcon } from "@/components/board/type-icon";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView, ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { themeSwatch } from "@/components/board/tokens";
import type { ThemeColor } from "@/core/db/schema";
import { MoveTo, NewFeature } from "./decompose-bits";

/** The first theme's swatch, or nothing: colour says why, never decorates. */
function stripeFor(themeIds: string[], structure: StructureLookup): string | null {
  const theme = themeIds[0] ? structure.themes.find((t) => t.id === themeIds[0]) : null;
  return theme ? themeSwatch(theme.color as ThemeColor) : null;
}

/** What is being carried: a feature looking for an epic, or a card looking for a feature. */
export type DragItem = { kind: "feature" | "card"; id: string } | null;

export type DecomposeHandlers = {
  drag: DragItem;
  setDrag: (item: DragItem) => void;
  onPlaceFeature: (featureId: string, epicId: string | null) => void;
  onPlaceCard: (cardId: string, featureId: string | null) => void;
  onAddCard: (featureId: string, title: string) => Promise<boolean>;
  onAddFeature: (epicId: string, title: string) => Promise<boolean>;
  /** The open sprints, for planning a feature from its menu; empty on Kanban. */
  sprints: import("@/core/db/schema").Sprint[];
  onPlanFeature: (featureId: string, sprintId: string | null) => void;
};

/** Shared drop wiring: highlight while a matching drag hovers, place on drop. */
export function useDrop(active: boolean, place: () => void) {
  const [over, setOver] = useState(false);
  if (!active) return { over: false, props: {} };
  return {
    over,
    props: {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      },
      onDragLeave: (event: React.DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node)) setOver(false);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        place();
      },
    },
  };
}

/** The line from a parent node down to its children's rail. */
const Stem = () => <div aria-hidden className="bg-border h-5 w-px" />;

/**
 * The WBS ladder: children stacked under their parent, each hung on the
 * one rail with an elbow — the classic chart, and the shape that keeps
 * a breakdown narrow no matter how many cards a feature holds.
 */
function Ladder({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 flex w-fit flex-col">{children}</ul>;
}

function Rung({ children }: { children: React.ReactNode }) {
  return (
    <li
      className={cn(
        "relative py-1 pl-4",
        "before:bg-border before:absolute before:top-0 before:bottom-0 before:left-0 before:w-px",
        "last:before:bottom-auto last:before:h-5",
        "after:bg-border after:absolute after:top-5 after:left-0 after:h-px after:w-4",
      )}
    >
      {children}
    </li>
  );
}

/** The children of one node, side by side, each connected up to the shared rail. */
function Branches({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start justify-center">{children}</div>;
}

function Branch({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-start px-1.5 pt-5",
        // The drop from the rail lands on the node's own centre (w-40/2 + px-1.5).
        "before:bg-border before:absolute before:top-0 before:left-[5.375rem] before:h-5 before:w-px",
        "after:bg-border after:absolute after:top-0 after:right-0 after:left-0 after:h-px",
        "first:after:left-[5.375rem] last:after:right-[calc(100%-5.375rem)] only:after:hidden",
      )}
    >
      {children}
    </div>
  );
}

/** One box in the chart: the symbol, the key, the title as a link, and its menu. */
export function ChartNode({
  icon,
  keyLabel,
  title,
  href,
  strike,
  emphasis,
  stripe,
  menu,
  fold,
  drop,
  dragProps,
  dragging,
}: {
  icon: React.ReactNode;
  keyLabel: string;
  title: string;
  href: string;
  strike?: boolean;
  emphasis?: boolean;
  /** The first theme's colour on the left edge — the same word the dots and bars speak. */
  stripe?: string | null;
  menu?: React.ReactNode;
  /** Folds what hangs under this node in and out. */
  fold?: { open: boolean; toggle: () => void };
  drop?: { over: boolean; props: object };
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  dragging?: boolean;
}) {
  return (
    <div
      {...dragProps}
      {...(drop?.props ?? {})}
      className={cn(
        "border-border group/box hover:border-primary/40 focus-within:border-primary/40 flex w-40 flex-col rounded-xl border px-2 py-1.5 shadow-[var(--surface-shadow)] transition-colors",
        emphasis ? "bg-accent/70 border-primary/30" : "bg-card",
        stripe && "border-l-4",
        dragProps?.draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        drop?.over && "border-primary bg-accent/60",
      )}
      style={stripe ? { borderLeftColor: stripe } : undefined}
    >
      {/* The title carries the box; symbol, key and menu step up into one quiet line. */}
      <div className="text-meta relative flex min-h-5 items-center justify-center gap-1.5">
        {fold && (
          <span className="absolute top-1/2 left-0 -translate-y-1/2">
            <FoldButton open={fold.open} onToggle={fold.toggle} />
          </span>
        )}
        {icon}
        <span className="font-mono text-2xs tabular-nums">{keyLabel}</span>
        {menu && <span className="absolute top-1/2 right-0 -translate-y-1/2">{menu}</span>}
      </div>
      <Link
        href={href}
        className={cn(
          "focus-ring line-clamp-3 text-center text-2sm leading-snug hover:underline",
          emphasis && "font-semibold",
          strike && "text-meta line-through",
        )}
        title={title}
      >
        {title}
      </Link>
    </div>
  );
}

/** A whole epic as a chart: the epic on top, features on the rail below, cards below each. */
export function EpicTree({
  epic,
  features,
  boardKey,
  boardId,
  structure,
  cardsOf,
  doneOf,
  h,
}: {
  epic: ItemView;
  features: ItemView[];
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  cardsOf: (featureId: string) => CardView[];
  doneOf: (card: CardView) => boolean;
  h: DecomposeHandlers;
}) {
  const drop = useDrop(h.drag?.kind === "feature", () => {
    if (h.drag) h.onPlaceFeature(h.drag.id, epic.id);
  });
  // Presence in the store means folded shut; a fresh chart stands open.
  const folded = useFolded(`${boardId}:decompose`);
  const shut = folded.isOpen(epic.id);
  return (
    <section aria-label={epic.title} className="flex w-fit flex-col items-center">
      <ChartNode
        icon={<TypeIcon type="epic" />}
        keyLabel={`${boardKey}-${epic.number}`}
        title={epic.title}
        href={`/boards/${boardId}/items/${epic.number}`}
        emphasis
        stripe={stripeFor(epic.themeIds, structure)}
        drop={drop}
        fold={{ open: !shut, toggle: () => folded.toggle(epic.id) }}
      />
      {!shut && (
        <>
          <Stem />
          <Branches>
            {features.map((feature) => (
              <Branch key={feature.id}>
                <FeatureTree
                  feature={feature}
                  boardKey={boardKey}
                  boardId={boardId}
                  structure={structure}
                  cards={cardsOf(feature.id)}
                  doneOf={doneOf}
                  h={h}
                />
              </Branch>
            ))}
            <Branch>
              <div className="border-input w-40 rounded-lg border border-dashed p-1.5">
                <NewFeature onAdd={(title) => h.onAddFeature(epic.id, title)} />
              </div>
            </Branch>
          </Branches>
        </>
      )}
    </section>
  );
}

/** A feature with its cards hanging under it; the root when the board hides epics. */
export function FeatureTree({
  feature,
  boardKey,
  boardId,
  structure,
  cards,
  doneOf,
  h,
}: {
  feature: ItemView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  cards: CardView[];
  doneOf: (card: CardView) => boolean;
  h: DecomposeHandlers;
}) {
  const t = useTranslations("decompose");
  const drop = useDrop(h.drag?.kind === "card", () => {
    if (h.drag) h.onPlaceCard(h.drag.id, feature.id);
  });
  const epics = structure.items.filter((i) => i.level === "epic" && i.state === "open");
  const folded = useFolded(`${boardId}:decompose`);
  const shut = folded.isOpen(feature.id);
  return (
    <div className="flex flex-col items-start">
      <ChartNode
        icon={<TypeIcon type="feature" />}
        keyLabel={`${boardKey}-${feature.number}`}
        title={feature.title}
        href={`/boards/${boardId}/items/${feature.number}`}
        stripe={stripeFor(feature.themeIds, structure)}
        fold={{ open: !shut, toggle: () => folded.toggle(feature.id) }}
        drop={drop}
        dragging={h.drag?.kind === "feature" && h.drag.id === feature.id}
        dragProps={{
          draggable: true,
          onDragStart: (event) => {
            event.dataTransfer.setData("text/plain", feature.id);
            event.dataTransfer.effectAllowed = "move";
            h.setDrag({ kind: "feature", id: feature.id });
          },
          onDragEnd: () => h.setDrag(null),
        }}
        menu={
          <MoveTo
            label={t("moveToEpic")}
            options={epics.filter((e) => e.id !== feature.parentId)}
            keyOf={(e) => `${boardKey}-${e.number}`}
            onMove={(epicId) => h.onPlaceFeature(feature.id, epicId)}
            withNone={feature.parentId !== null}
            plan={{
              sprints: h.sprints,
              current: feature.targetSprintId,
              onPlan: (sprintId) => h.onPlanFeature(feature.id, sprintId),
            }}
          />
        }
      />
      {!shut && (
        <Ladder>
          {cards.map((card) => (
            <Rung key={card.id}>
              <CardNode
                card={card}
                boardKey={boardKey}
                boardId={boardId}
                done={doneOf(card)}
                structure={structure}
                h={h}
              />
            </Rung>
          ))}
          <Rung>
            <div className="border-input w-40 rounded-lg border border-dashed p-1">
              <QuickAdd
                compact
                structure={structure}
                fixed={{ featureId: feature.id }}
                onAdd={(title) => h.onAddCard(feature.id, title)}
              />
            </div>
          </Rung>
        </Ladder>
      )}
    </div>
  );
}

export function CardNode({
  card,
  boardKey,
  boardId,
  done,
  structure,
  h,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  done: boolean;
  structure: StructureLookup;
  h: DecomposeHandlers;
}) {
  const t = useTranslations("decompose");
  const features = structure.items.filter((i) => i.level === "feature" && i.state === "open");
  return (
    <ChartNode
      icon={<TypeIcon type={card.bug ? "bug" : "card"} />}
      keyLabel={`${boardKey}-${card.number}`}
      title={card.title}
      href={`/boards/${boardId}/cards/${card.number}`}
      strike={done}
      stripe={stripeFor(card.themeIds, structure)}
      dragging={h.drag?.kind === "card" && h.drag.id === card.id}
      dragProps={{
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.setData("text/plain", card.id);
          event.dataTransfer.effectAllowed = "move";
          event.stopPropagation();
          h.setDrag({ kind: "card", id: card.id });
        },
        onDragEnd: () => h.setDrag(null),
      }}
      menu={
        <MoveTo
          label={t("moveToFeature")}
          options={features.filter((f) => f.id !== card.featureId)}
          keyOf={(f) => `${boardKey}-${f.number}`}
          onMove={(featureId) => h.onPlaceCard(card.id, featureId)}
          withNone={card.featureId !== null}
        />
      }
    />
  );
}
