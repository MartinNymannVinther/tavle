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
import { reviewDue } from "@/modules/boards/structure/rules";
import type { BoardFull, ItemView } from "@/modules/boards/types";
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

type Drag = { kind: "item"; id: string; scope: string } | { kind: "card"; id: string };

export function ItemBacklog({
  full,
  level,
  structure,
  tree,
  run,
  onRankItem,
  onNudgeCard,
  newFeature,
}: {
  full: BoardFull;
  level: "epic" | "feature";
  structure: StructureLookup;
  tree: Hierarchy;
  run: Run;
  onRankItem: (itemId: string, siblingId: string, after: boolean) => void;
  onNudgeCard: (cardId: string, siblingId: string, after: boolean) => void;
  newFeature: (epicId: string) => React.ReactNode;
}) {
  const t = useTranslations("backlog");
  const s = useTranslations("boards.structure");
  const { board } = full;
  const folded = useFolded(`${board.id}:levels`);
  const [drag, setDrag] = useState<Drag | null>(null);

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
          onDragEnd={() => setDrag(null)}
          onDragOver={(event) => {
            if (drag?.kind === "item" && drag.scope === options.scope && drag.id !== item.id) {
              event.preventDefault();
            }
          }}
          onDrop={() => {
            if (drag?.kind === "item" && drag.scope === options.scope && drag.id !== item.id) {
              onRankItem(drag.id, item.id, false);
            }
            setDrag(null);
          }}
          className={cn(
            "group/row hover:bg-secondary/40 flex cursor-grab items-start gap-2 py-2 pr-3 transition-colors duration-[120ms] active:cursor-grabbing",
            drag?.kind === "item" && drag.id === item.id && "opacity-40",
          )}
          style={{ paddingLeft: `${0.75 + (options.depth ?? 0) * 1.25}rem` }}
        >
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

  const cardRows = (node: FeatureNode, depth: number) => (
    <div className="border-hairline ml-4 border-l" style={{ marginLeft: `${depth * 1.25}rem` }}>
      {node.stories.length === 0 ? (
        <p className="text-meta px-4 py-1.5 text-xs">{t("levels.noStories")}</p>
      ) : (
        <ol>
          {node.stories.map((card, index) => (
            <BacklogRow
              key={card.id}
              card={card}
              boardKey={board.key}
              boardId={board.id}
              structure={structure}
              context={{ areaId: node.feature.areaId, themeIds: node.feature.themeIds }}
              draggable
              onDragStart={() => setDrag({ kind: "card", id: card.id })}
              onDragOver={(event) => {
                if (drag?.kind === "card" && drag.id !== card.id) event.preventDefault();
              }}
              onDrop={() => {
                if (drag?.kind === "card" && drag.id !== card.id) {
                  onNudgeCard(drag.id, card.id, false);
                }
                setDrag(null);
              }}
              dragging={drag?.kind === "card" && drag.id === card.id}
              onMoveUp={
                index > 0
                  ? () => onNudgeCard(card.id, node.stories[index - 1]!.id, false)
                  : undefined
              }
              onMoveDown={
                index < node.stories.length - 1
                  ? () => onNudgeCard(card.id, node.stories[index + 1]!.id, true)
                  : undefined
              }
            />
          ))}
        </ol>
      )}
      {(node.elsewhere.open > 0 || node.elsewhere.done > 0) && (
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
      {tree.looseStories.length > 0 && (
        <>
          {looseHeading(t("nav.noParent"))}
          <ol>
            {tree.looseStories.map((card) => (
              <BacklogRow
                key={card.id}
                card={card}
                boardKey={board.key}
                boardId={board.id}
                structure={structure}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
