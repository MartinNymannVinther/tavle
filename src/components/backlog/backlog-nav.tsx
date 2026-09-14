"use client";

import { CircleDashed } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { TypeIcon } from "@/components/board/type-icon";
import type { ItemView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { FoldButton, RankArrows } from "./backlog-bits";
import { ALL, LOOSE, parseSelection, selectionKey, type Selection } from "./backlog-selection";
import type { FeatureNode, Hierarchy } from "./group-backlog";

/**
 * The decomposition as a navigator: epics with their features under
 * them, what has no parent at the bottom, each with the number of
 * backlog stories it holds. Clicking narrows the list to that node; the
 * chevron folds an epic; the arrows rank an epic or a feature among its
 * level. Titles only — the item itself is one click further, in the
 * list's heading.
 */
export type NavProps = {
  tree: Hierarchy;
  counts: Map<string, number>;
  total: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  showClosed: boolean;
  onShowClosed: (show: boolean) => void;
  onRank: (itemId: string, siblingId: string, after: boolean) => void;
  /** A dragged backlog card dropped on a feature (or on "no parent": null). */
  onDropCard?: (featureId: string | null) => void;
  /** Renders the "new feature" affordance for an epic without any. */
  newFeature?: (epicId: string) => React.ReactNode;
};

const same = (a: Selection, b: Selection) => selectionKey(a) === selectionKey(b);

function Node({
  selected,
  onClick,
  fold,
  icon,
  title,
  count,
  arrows,
  depth = 0,
  className,
  onDropCard,
}: {
  selected: boolean;
  onClick: () => void;
  fold?: { open: boolean; onToggle: () => void };
  icon: React.ReactNode;
  title: string;
  count: number;
  arrows?: { onUp?: () => void; onDown?: () => void };
  depth?: number;
  className?: string;
  /** The node takes a dragged card: dropping it here sets its parent. */
  onDropCard?: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn(
        "group/row flex items-start gap-1 rounded-md pr-1",
        selected ? "bg-card font-semibold shadow-[var(--surface-shadow)]" : "hover:bg-card/60",
        onDropCard && over && "ring-primary bg-accent/60 ring-1",
        className,
      )}
      style={{ paddingLeft: `${depth * 1.25}rem` }}
      {...(onDropCard && {
        onDragOver: (event: React.DragEvent) => {
          event.preventDefault();
          setOver(true);
        },
        onDragLeave: (event: React.DragEvent) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node)) {
            setOver(false);
          }
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          setOver(false);
          onDropCard();
        },
      })}
    >
      {fold ? (
        <FoldButton open={fold.open} onToggle={fold.onToggle} />
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 items-start gap-2 py-1.5 text-left text-2sm leading-snug"
      >
        <span className="mt-px shrink-0">{icon}</span>
        <span className="line-clamp-2 min-w-0 flex-1">{title}</span>
        <span className="text-meta shrink-0 text-xs font-normal tabular-nums">{count}</span>
      </button>
      {arrows && <RankArrows onUp={arrows.onUp} onDown={arrows.onDown} />}
    </div>
  );
}

function FeatureNodes({ nodes, depth, p }: { nodes: FeatureNode[]; depth: number; p: NavProps }) {
  return (
    <>
      {nodes.map((node, index) => {
        const feature = node.feature;
        const before = nodes[index - 1]?.feature.id;
        const after = nodes[index + 1]?.feature.id;
        return (
          <Node
            key={feature.id}
            depth={depth}
            selected={same(p.selection, { kind: "feature", id: feature.id })}
            onClick={() => p.onSelect({ kind: "feature", id: feature.id })}
            icon={<TypeIcon type="feature" />}
            title={feature.title}
            count={p.counts.get(feature.id) ?? 0}
            arrows={{
              onUp: before ? () => p.onRank(feature.id, before, false) : undefined,
              onDown: after ? () => p.onRank(feature.id, after, true) : undefined,
            }}
            className={feature.state === "closed" ? "text-meta line-through" : undefined}
            onDropCard={
              p.onDropCard && feature.state === "open" ? () => p.onDropCard!(feature.id) : undefined
            }
          />
        );
      })}
    </>
  );
}

export function BacklogNav(p: NavProps) {
  const t = useTranslations("backlog.nav");
  const { tree } = p;
  const loose = tree.looseFeatures.length > 0 || tree.looseStories.length > 0;
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-0.5 text-sm">
      <Node
        selected={same(p.selection, ALL)}
        onClick={() => p.onSelect(ALL)}
        icon={null}
        title={t("all")}
        count={p.total}
      />
      {tree.epics.map((node, index) => {
        const epic = node.epic;
        const open = p.isOpen(epic.id);
        const before = tree.epics[index - 1]?.epic.id;
        const after = tree.epics[index + 1]?.epic.id;
        return (
          <div key={epic.id}>
            <Node
              selected={same(p.selection, { kind: "epic", id: epic.id })}
              onClick={() => p.onSelect({ kind: "epic", id: epic.id })}
              fold={{ open, onToggle: () => p.toggle(epic.id) }}
              icon={<TypeIcon type="epic" />}
              title={epic.title}
              count={p.counts.get(epic.id) ?? 0}
              arrows={{
                onUp: before ? () => p.onRank(epic.id, before, false) : undefined,
                onDown: after ? () => p.onRank(epic.id, after, true) : undefined,
              }}
              className={epic.state === "closed" ? "text-meta line-through" : undefined}
            />
            {open && node.features.length > 0 && (
              <FeatureNodes nodes={node.features} depth={1} p={p} />
            )}
            {open && node.features.length === 0 && (
              <p className="text-meta flex items-center gap-2 py-1 pl-12 text-xs">
                {t("noFeatures")}
                {epic.state === "open" && p.newFeature?.(epic.id)}
              </p>
            )}
          </div>
        );
      })}
      {loose && (
        <div>
          <Node
            selected={same(p.selection, LOOSE)}
            onClick={() => p.onSelect(LOOSE)}
            fold={
              tree.looseFeatures.length > 0
                ? { open: p.isOpen("loose"), onToggle: () => p.toggle("loose") }
                : undefined
            }
            icon={
              <span className="text-label border-input inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-xs border border-dashed">
                <CircleDashed className="size-3" aria-hidden />
              </span>
            }
            title={t("noParent")}
            count={tree.looseStories.length}
            onDropCard={p.onDropCard ? () => p.onDropCard!(null) : undefined}
          />
          {p.isOpen("loose") && <FeatureNodes nodes={tree.looseFeatures} depth={1} p={p} />}
        </div>
      )}
      <label className="text-meta mt-3 flex items-center gap-1.5 px-2 text-2sm">
        <input
          type="checkbox"
          checked={p.showClosed}
          onChange={(event) => p.onShowClosed(event.target.checked)}
          className="accent-[var(--primary)]"
        />
        {t("showClosed")}
      </label>
    </nav>
  );
}

/** The same choice as one <select>, for screens too narrow for a column. */
export function BacklogNavSelect({
  tree,
  counts,
  total,
  selection,
  onSelect,
}: Pick<NavProps, "tree" | "counts" | "total" | "selection" | "onSelect">) {
  const t = useTranslations("backlog.nav");
  const option = (item: ItemView, depth: number) => (
    <option key={item.id} value={`${item.level}:${item.id}`}>
      {"\u00a0".repeat(depth * 3)}
      {item.title} ({counts.get(item.id) ?? 0})
    </option>
  );
  return (
    <NativeSelect
      variant="sm"
      value={selectionKey(selection)}
      onChange={(event) => onSelect(parseSelection(event.target.value))}
      aria-label={t("label")}
    >
      <option value="all">
        {t("all")} ({total})
      </option>
      {tree.epics.flatMap((node) => [
        option(node.epic, 0),
        ...node.features.map((f) => option(f.feature, 1)),
      ])}
      {(tree.looseFeatures.length > 0 || tree.looseStories.length > 0) && (
        <option value="loose">
          {t("noParent")} ({tree.looseStories.length})
        </option>
      )}
      {tree.looseFeatures.map((f) => option(f.feature, 1))}
    </NativeSelect>
  );
}
