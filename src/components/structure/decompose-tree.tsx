"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

/** The children of one node, side by side, each connected up to the shared rail. */
function Branches({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start justify-center">{children}</div>;
}

function Branch({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center px-1.5 pt-5",
        "before:bg-border before:absolute before:top-0 before:left-1/2 before:h-5 before:w-px",
        "after:bg-border after:absolute after:top-0 after:right-0 after:left-0 after:h-px",
        "first:after:left-1/2 last:after:right-1/2 only:after:hidden",
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
  drop?: { over: boolean; props: object };
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  dragging?: boolean;
}) {
  return (
    <div
      {...dragProps}
      {...(drop?.props ?? {})}
      className={cn(
        "border-border group/box flex w-[11.5rem] items-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-[var(--surface-shadow)] transition-colors",
        emphasis ? "bg-accent/70 border-primary/30" : "bg-card",
        stripe && "border-l-4",
        dragProps?.draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        drop?.over && "border-primary bg-accent/60",
      )}
      style={stripe ? { borderLeftColor: stripe } : undefined}
    >
      {icon}
      <span className="text-meta font-mono shrink-0 text-[0.69rem] tabular-nums">{keyLabel}</span>
      <Link
        href={href}
        className={cn(
          "line-clamp-2 min-w-0 flex-1 text-[0.78rem] leading-snug hover:underline",
          emphasis && "font-semibold",
          strike && "text-meta line-through",
        )}
        title={title}
      >
        {title}
      </Link>
      {menu}
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
  return (
    <section aria-label={epic.title} className="flex w-fit min-w-full flex-col items-center">
      <ChartNode
        icon={<TypeIcon type="epic" />}
        keyLabel={`${boardKey}-${epic.number}`}
        title={epic.title}
        href={`/boards/${boardId}/items/${epic.number}`}
        emphasis
        stripe={stripeFor(epic.themeIds, structure)}
        drop={drop}
      />
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
          <div className="border-border w-[11.5rem] rounded-lg border border-dashed p-1.5">
            <NewFeature onAdd={(title) => h.onAddFeature(epic.id, title)} />
          </div>
        </Branch>
      </Branches>
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
  return (
    <div className="flex flex-col items-center">
      <ChartNode
        icon={<TypeIcon type="feature" />}
        keyLabel={`${boardKey}-${feature.number}`}
        title={feature.title}
        href={`/boards/${boardId}/items/${feature.number}`}
        stripe={stripeFor(feature.themeIds, structure)}
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
          />
        }
      />
      <Stem />
      <Branches>
        {cards.map((card) => (
          <Branch key={card.id}>
            <CardNode
              card={card}
              boardKey={boardKey}
              boardId={boardId}
              done={doneOf(card)}
              structure={structure}
              h={h}
            />
          </Branch>
        ))}
        <Branch>
          <div className="border-border w-[11.5rem] rounded-lg border border-dashed p-1">
            <QuickAdd
              compact
              structure={structure}
              fixed={{ featureId: feature.id }}
              onAdd={(title) => h.onAddCard(feature.id, title)}
            />
          </div>
        </Branch>
      </Branches>
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
