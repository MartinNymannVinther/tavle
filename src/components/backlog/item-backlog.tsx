"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StatusChip, ThemeDots } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { TypeIcon } from "@/components/board/type-icon";
import type { Run } from "@/components/board/use-board-actions";
import type { Theme } from "@/core/db/schema";
import { createCardAction } from "@/modules/boards/actions-cards";
import { mergeByRank } from "@/modules/boards/ordering";
import { reviewDue } from "@/modules/boards/structure/rules";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BacklogRow } from "./backlog-row";
import { FoldButton, Key, ProgressBar, RankArrows } from "./backlog-bits";
import {
  epicProgress,
  featureProgress,
  type EpicNode,
  type FeatureNode,
  type Hierarchy,
} from "./group-backlog";
import { useFolded } from "./use-folded";

/**
 * The backlog at altitude (docs/adr/0027): the same decomposition the
 * navigator shows, as the list itself. The epic backlog folds out to
 * features and on to cards; the feature backlog folds out to cards.
 * Rank is still one order per level — a drag or an arrow moves a thing
 * past its sibling, exactly the write the flat list makes.
 */

type Drag =
  | { kind: "item"; id: string; scope: string }
  /** A card ranks among the siblings it is shown with: a feature's fold-out, or what has no parent. */
  | { kind: "card"; id: string; featureId: string | null };

export function ItemBacklog({
  full,
  level,
  structure,
  tree,
  run,
  onRankItem,
  onNudgeCard,
  onMoveCard,
  allocated = [],
  sprintNameOf,
  newFeature,
}: {
  full: BoardFull;
  level: "epic" | "feature";
  structure: StructureLookup;
  tree: Hierarchy;
  run: Run;
  onRankItem: (itemId: string, siblingId: string, after: boolean) => void;
  onNudgeCard: (cardId: string, siblingId: string, after: boolean) => void;
  /** A card dropped on another feature — placement across the tree, then the spot it landed on. */
  onMoveCard: (cardId: string, featureId: string, siblingId: string | null, after: boolean) => void;
  /** Cards already committed to an open sprint: shown marked under their feature, not ranked. */
  allocated?: CardView[];
  sprintNameOf?: Map<string, string>;
  newFeature: (epicId: string) => React.ReactNode;
}) {
  const t = useTranslations("backlog");
  const s = useTranslations("boards.structure");
  const { board } = full;
  const folded = useFolded(`${board.id}:levels`);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Where the dragged thing will land: a line above or below a row, or
  // a whole feature lit up as the drop's new home.
  const [hover, setHover] = useState<
    { kind: "slot"; id: string; after: boolean } | { kind: "feature"; id: string } | null
  >(null);
  const settle = () => {
    setDrag(null);
    setHover(null);
  };

  const allocatedOf = (featureId: string | null) =>
    allocated.filter((card) => card.featureId === featureId);
  const markedRow = (card: CardView, context?: { areaId: string | null; themeIds: string[] }) => (
    <BacklogRow
      key={card.id}
      card={card}
      boardKey={board.key}
      boardId={board.id}
      structure={structure}
      context={context}
      sprintName={(card.sprintId && sprintNameOf?.get(card.sprintId)) || undefined}
    />
  );
  /**
   * One backlog card as a ranked row. Its siblings are the free rows it
   * is shown beside — a feature's fold-out, or the cards with no parent
   * under their own heading — so every card on the page can be moved by
   * a drag and by the arrows, at every altitude (docs/adr/0027).
   */
  const storyRow = (
    card: CardView,
    siblings: CardView[],
    featureId: string | null,
    context?: { areaId: string | null; themeIds: string[] },
  ) => {
    const index = siblings.findIndex((sibling) => sibling.id === card.id);
    // The drop stays among those siblings: a drag across features would
    // reorder invisibly, and moving a card to another feature is
    // placement, not rank.
    const among = drag?.kind === "card" && drag.featureId === featureId && drag.id !== card.id;
    return (
      <BacklogRow
        key={card.id}
        card={card}
        boardKey={board.key}
        boardId={board.id}
        structure={structure}
        context={context}
        draggable
        onDragStart={() => setDrag({ kind: "card", id: card.id, featureId })}
        onDragOver={(event) => {
          if (among) event.preventDefault();
        }}
        onDrop={() => {
          if (among && drag?.kind === "card") onNudgeCard(drag.id, card.id, false);
          setDrag(null);
        }}
        dragging={drag?.kind === "card" && drag.id === card.id}
        onMoveUp={
          index > 0 ? () => onNudgeCard(card.id, siblings[index - 1]!.id, false) : undefined
        }
        onMoveDown={
          index < siblings.length - 1
            ? () => onNudgeCard(card.id, siblings[index + 1]!.id, true)
            : undefined
        }
      />
    );
  };
  const epicOf = (feature: ItemView) =>
    feature.parentId ? full.items.find((i) => i.id === feature.parentId) : undefined;
  const allFeatures = [...tree.epics.flatMap((e) => e.features), ...tree.looseFeatures].sort(
    (a, b) => a.feature.sort - b.feature.sort || a.feature.number - b.feature.number,
  );

  const itemRow = (
    item: ItemView,
    options: {
      scope: string;
      siblings: ItemView[];
      progress: ReturnType<typeof epicProgress>;
      crumb?: string;
      children?: React.ReactNode;
      depth?: number;
    },
  ) => {
    const at = options.siblings.findIndex((sibling) => sibling.id === item.id);
    const up = options.siblings[at - 1];
    const down = options.siblings[at + 1];
    const open = folded.isOpen(item.id);
    const themes = structure.view.themes
      ? item.themeIds
          .map((id) => structure.themes.find((theme) => theme.id === id))
          .filter((theme): theme is Theme => Boolean(theme))
      : [];
    const due = item.level === "epic" && reviewDue(item, board.epicReviewDays);
    return (
      <li key={item.id} className="flex flex-col">
        <div
          draggable
          onDragStart={() => setDrag({ kind: "item", id: item.id, scope: options.scope })}
          onDragOver={(event) => {
            if (drag?.kind === "item" && drag.scope === options.scope && drag.id !== item.id) {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const below = event.clientY > rect.top + rect.height / 2;
              if (hover?.kind !== "slot" || hover.id !== item.id || hover.after !== below) {
                setHover({ kind: "slot", id: item.id, after: below });
              }
            }
            if (drag?.kind === "card" && item.level === "feature") {
              event.preventDefault();
              if (hover?.kind !== "feature" || hover.id !== item.id) {
                setHover({ kind: "feature", id: item.id });
              }
            }
          }}
          onDrop={() => {
            if (drag?.kind === "item" && drag.scope === options.scope && drag.id !== item.id) {
              onRankItem(
                drag.id,
                item.id,
                hover?.kind === "slot" && hover.id === item.id ? hover.after : false,
              );
            }
            if (drag?.kind === "card" && item.level === "feature") {
              onMoveCard(drag.id, item.id, null, false);
            }
            settle();
          }}
          onDragEnd={settle}
          className={cn(
            "group/row hover:bg-secondary/40 relative flex cursor-grab items-start gap-2 py-2 pr-3 transition-colors duration-[120ms] active:cursor-grabbing",
            drag?.kind === "item" && drag.id === item.id && "opacity-40",
            hover?.kind === "feature" && hover.id === item.id && "bg-accent/60",
          )}
          style={{ paddingLeft: `${0.75 + (options.depth ?? 0) * 1.25}rem` }}
        >
          {hover?.kind === "slot" && hover.id === item.id && drag?.id !== item.id && (
            <span
              aria-hidden
              className={cn(
                "bg-primary absolute inset-x-1 z-10 h-0.5 rounded-full",
                hover.after ? "-bottom-px" : "-top-px",
              )}
            />
          )}
          <FoldButton open={open} onToggle={() => folded.toggle(item.id)} />
          <TypeIcon type={item.level as "epic" | "feature"} className="mt-0.5" />
          <span className="mt-0.5 shrink-0">
            <Key boardKey={board.key} number={item.number} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link
                href={`/boards/${board.id}/items/${item.number}`}
                className={cn(
                  "line-clamp-2 min-w-0 text-sm leading-snug font-medium hover:underline",
                  item.state === "closed" && "text-meta line-through",
                )}
              >
                {item.title}
              </Link>
              <ThemeDots themes={themes} />
              {due && <StatusChip tone="warning">{s("forReview")}</StatusChip>}
            </span>
            {item.description && (
              <p className="text-meta mt-0.5 hidden text-xs @3xl:line-clamp-1">
                {item.description}
              </p>
            )}
            {options.crumb && (
              <p className="text-meta mt-0.5 flex items-center gap-1 text-2xs">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <TypeIcon type="epic" className="size-3 shrink-0" />
                  <span className="truncate">{options.crumb}</span>
                </span>
              </p>
            )}
          </div>
          <ProgressBar progress={options.progress} className="mt-1" />
          <RankArrows
            onUp={up ? () => onRankItem(item.id, up.id, false) : undefined}
            onDown={down ? () => onRankItem(item.id, down.id, true) : undefined}
          />
        </div>
        {open && options.children}
      </li>
    );
  };

  const cardRows = (node: FeatureNode, depth: number) => {
    // The feature's committed cards stand at their rank among the free
    // ones — one priority (docs/adr/0033), the sprint's name saying why
    // these rows neither drag nor tick.
    const merged = mergeByRank(node.stories, allocatedOf(node.feature.id));
    return (
      <div className="border-hairline ml-4 border-l" style={{ marginLeft: `${depth * 1.25}rem` }}>
        {merged.length === 0 ? (
          <p
            onDragOver={(event) => {
              if (drag?.kind === "card" && drag.featureId !== node.feature.id) {
                event.preventDefault();
                if (hover?.kind !== "feature" || hover.id !== node.feature.id) {
                  setHover({ kind: "feature", id: node.feature.id });
                }
              }
            }}
            onDrop={() => {
              if (drag?.kind === "card" && drag.featureId !== node.feature.id) {
                onMoveCard(drag.id, node.feature.id, null, false);
              }
              settle();
            }}
            className={cn(
              "text-meta px-4 py-1.5 text-xs",
              hover?.kind === "feature" && hover.id === node.feature.id && "bg-accent/60",
            )}
          >
            {t("levels.noStories")}
          </p>
        ) : (
          <ol>
            {merged.map(({ card, committed }) => {
              const place = { areaId: node.feature.areaId, themeIds: node.feature.themeIds };
              return committed
                ? markedRow(card, place)
                : storyRow(card, node.stories, node.feature.id, place);
            })}
          </ol>
        )}
        {board.mode === "scrum"
          ? node.elsewhere.done > 0 && (
              <p className="text-meta px-4 pb-1.5 text-2xs">
                {t("levels.doneElsewhere", { done: node.elsewhere.done })}
              </p>
            )
          : (node.elsewhere.open > 0 || node.elsewhere.done > 0) && (
              <p className="text-meta px-4 pb-1.5 text-2xs">
                {t("levels.elsewhere", { open: node.elsewhere.open, done: node.elsewhere.done })}
              </p>
            )}
        <div className="px-3 pb-2">
          <QuickAdd
            onAdd={(title) =>
              run(() => createCardAction({ boardId: board.id, title, featureId: node.feature.id }))
            }
            structure={structure}
            fixed={{ featureId: node.feature.id }}
            compact
          />
        </div>
      </div>
    );
  };

  const featureSection = (node: FeatureNode, scope: string, siblings: ItemView[], depth: number) =>
    itemRow(node.feature, {
      scope,
      siblings,
      progress: featureProgress(node),
      crumb: level === "feature" ? epicOf(node.feature)?.title : undefined,
      children: cardRows(node, depth),
      depth,
    });

  const epicSection = (node: EpicNode) => {
    const siblings = tree.epics.map((e) => e.epic);
    return itemRow(node.epic, {
      scope: "epics",
      siblings,
      progress: epicProgress(node),
      depth: 0,
      children: (
        <div>
          {node.features.length === 0 ? (
            <p className="text-meta py-1.5 pl-12 text-xs">{t("nav.noFeatures")}</p>
          ) : (
            <ol>
              {node.features.map((feature) =>
                featureSection(
                  feature,
                  `under:${node.epic.id}`,
                  node.features.map((f) => f.feature),
                  1,
                ),
              )}
            </ol>
          )}
          <div className="py-1 pl-12">{newFeature(node.epic.id)}</div>
        </div>
      ),
    });
  };

  const looseHeading = (label: string) => (
    <p className="text-label border-hairline border-t px-3 pt-3 pb-1 text-2xs font-medium">
      {label}
    </p>
  );

  return (
    <div className="flex flex-col">
      <ol className="divide-hairline divide-y">
        {level === "epic"
          ? tree.epics.map(epicSection)
          : allFeatures.map((node) =>
              featureSection(
                node,
                "features",
                allFeatures.map((f) => f.feature),
                0,
              ),
            )}
      </ol>
      {level === "epic" && tree.looseFeatures.length > 0 && (
        <>
          {looseHeading(t("nav.noParent"))}
          <ol className="divide-hairline divide-y">
            {tree.looseFeatures.map((node) =>
              featureSection(
                node,
                "loose",
                tree.looseFeatures.map((f) => f.feature),
                0,
              ),
            )}
          </ol>
        </>
      )}
      {(tree.looseStories.length > 0 || allocatedOf(null).length > 0) && (
        <>
          {looseHeading(t("nav.noParent"))}
          {/* The cards with no feature are each other's siblings under their
              own heading, so they rank like every other row on the page. */}
          <ol>
            {mergeByRank(tree.looseStories, allocatedOf(null)).map(({ card, committed }) =>
              committed ? markedRow(card) : storyRow(card, tree.looseStories, null),
            )}
          </ol>
        </>
      )}
    </div>
  );
}
