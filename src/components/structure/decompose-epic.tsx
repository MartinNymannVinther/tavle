"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QuickAdd } from "@/components/board/quick-add";
import { TypeIcon } from "@/components/board/type-icon";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView, ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { MoveTo, NewFeature } from "./decompose-bits";

/** What is being carried: a feature looking for an epic, or a card looking for a feature. */
export type DragItem = { kind: "feature" | "card"; id: string } | null;

export type DecomposeHandlers = {
  drag: DragItem;
  setDrag: (item: DragItem) => void;
  /** A feature put under an epic, or under none. */
  onPlaceFeature: (featureId: string, epicId: string | null) => void;
  /** A card put under a feature, or under none. */
  onPlaceCard: (cardId: string, featureId: string | null) => void;
  onAddCard: (featureId: string, title: string) => Promise<boolean>;
  onAddFeature: (epicId: string, title: string) => Promise<boolean>;
};

/** Shared drop wiring: highlight while a matching drag hovers, place on drop. */
function useDrop(active: boolean, place: () => void) {
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

/** One epic as a column: its features contained, a way to start one, a drop zone for more. */
export function EpicColumn({
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
  const t = useTranslations("decompose");
  const drop = useDrop(h.drag?.kind === "feature", () => {
    if (h.drag) h.onPlaceFeature(h.drag.id, epic.id);
  });
  return (
    <section
      aria-label={epic.title}
      {...drop.props}
      className={cn(
        "border-border bg-card flex w-[20rem] shrink-0 flex-col gap-2 rounded-xl border p-3 shadow-[var(--surface-shadow)] transition-colors",
        drop.over && "border-primary bg-accent/60",
      )}
    >
      <header className="flex items-start gap-2">
        <TypeIcon type="epic" className="mt-0.5" />
        <Link
          href={`/boards/${boardId}/items/${epic.number}`}
          className="min-w-0 flex-1 text-sm font-semibold hover:underline"
        >
          <span className="text-meta mr-1.5 font-mono text-[0.72rem] font-normal tabular-nums">
            {boardKey}-{epic.number}
          </span>
          {epic.title}
        </Link>
      </header>
      {features.length === 0 && !drop.over && (
        <p className="border-border text-meta rounded-lg border border-dashed p-3 text-center text-xs">
          {t("epicEmpty")}
        </p>
      )}
      {features.map((feature) => (
        <FeatureBox
          key={feature.id}
          feature={feature}
          boardKey={boardKey}
          boardId={boardId}
          structure={structure}
          cards={cardsOf(feature.id)}
          doneOf={doneOf}
          epics={structure.items.filter((i) => i.level === "epic" && i.state === "open")}
          h={h}
        />
      ))}
      <NewFeature onAdd={(title) => h.onAddFeature(epic.id, title)} />
    </section>
  );
}

/** One feature as a box: its cards contained, quick add for more, a drop zone for cards. */
export function FeatureBox({
  feature,
  boardKey,
  boardId,
  structure,
  cards,
  doneOf,
  epics,
  h,
}: {
  feature: ItemView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  cards: CardView[];
  doneOf: (card: CardView) => boolean;
  epics: ItemView[];
  h: DecomposeHandlers;
}) {
  const t = useTranslations("decompose");
  const drop = useDrop(h.drag?.kind === "card", () => {
    if (h.drag) h.onPlaceCard(h.drag.id, feature.id);
  });
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", feature.id);
        event.dataTransfer.effectAllowed = "move";
        h.setDrag({ kind: "feature", id: feature.id });
      }}
      onDragEnd={() => h.setDrag(null)}
      {...drop.props}
      className={cn(
        "border-border bg-secondary/50 group/box flex cursor-grab flex-col gap-1 rounded-lg border p-2 active:cursor-grabbing",
        h.drag?.kind === "feature" && h.drag.id === feature.id && "opacity-40",
        drop.over && "border-primary bg-accent/60",
      )}
    >
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
        <TypeIcon type="feature" />
        <span className="text-meta font-mono shrink-0 text-[0.69rem] tabular-nums">
          {boardKey}-{feature.number}
        </span>
        <Link
          href={`/boards/${boardId}/items/${feature.number}`}
          className="min-w-0 flex-1 truncate hover:underline"
        >
          {feature.title}
        </Link>
        <MoveTo
          label={t("moveToEpic")}
          options={epics.filter((e) => e.id !== feature.parentId)}
          keyOf={(e) => `${boardKey}-${e.number}`}
          onMove={(epicId) => h.onPlaceFeature(feature.id, epicId)}
          withNone={feature.parentId !== null}
        />
      </p>
      {cards.map((card) => (
        <CardRow
          key={card.id}
          card={card}
          boardKey={boardKey}
          boardId={boardId}
          done={doneOf(card)}
          features={structure.items.filter((i) => i.level === "feature" && i.state === "open")}
          h={h}
        />
      ))}
      <QuickAdd
        compact
        structure={structure}
        fixed={{ featureId: feature.id }}
        onAdd={(title) => h.onAddCard(feature.id, title)}
      />
    </div>
  );
}

export function CardRow({
  card,
  boardKey,
  boardId,
  done,
  features,
  h,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  done: boolean;
  /** The open features the menu can move the card to. */
  features: ItemView[];
  h: DecomposeHandlers;
}) {
  const t = useTranslations("decompose");
  return (
    <p
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        event.stopPropagation();
        h.setDrag({ kind: "card", id: card.id });
      }}
      onDragEnd={() => h.setDrag(null)}
      className={cn(
        "bg-card border-border group/box flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1 text-[0.78rem] active:cursor-grabbing",
        h.drag?.kind === "card" && h.drag.id === card.id && "opacity-40",
      )}
    >
      <TypeIcon type={card.bug ? "bug" : "card"} />
      <span className="text-meta font-mono shrink-0 text-[0.69rem] tabular-nums">
        {boardKey}-{card.number}
      </span>
      <Link
        href={`/boards/${boardId}/cards/${card.number}`}
        className={cn("min-w-0 flex-1 truncate hover:underline", done && "text-meta line-through")}
      >
        {card.title}
      </Link>
      <MoveTo
        label={t("moveToFeature")}
        options={features.filter((f) => f.id !== card.featureId)}
        keyOf={(f) => `${boardKey}-${f.number}`}
        onMove={(featureId) => h.onPlaceCard(card.id, featureId)}
        withNone={card.featureId !== null}
      />
    </p>
  );
}
