"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Progress } from "./group-backlog";

/**
 * The small parts every backlog line is built from: the key, the fold
 * button, the rank arrows and the progress bar. Kept together so an
 * epic, a feature and a story line up the same way.
 */

/** The key, in the mono face so WEB-12 and WEB-9 read as the same width. */
export function Key({ boardKey, number }: { boardKey: string; number: number }) {
  return (
    <span className="text-meta font-mono shrink-0 text-[0.72rem] font-normal tabular-nums">
      {boardKey}-{number}
    </span>
  );
}

/** Opens and closes what sits under a line; the chevron points at the state. */
export function FoldButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const f = useTranslations("backlog.fold");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-expanded={open}
      aria-label={open ? f("close") : f("open")}
      onClick={onToggle}
      className="text-label -ml-1 size-6"
    >
      <ChevronRight
        className={cn("size-3.5 transition-transform duration-[120ms]", open && "rotate-90")}
        aria-hidden
      />
    </Button>
  );
}

/**
 * Up and down within the line's own order. Shown on hover where a mouse
 * exists and always on touch, so every move has a button as well as a
 * drag.
 */
export function RankArrows({ onUp, onDown }: { onUp?: () => void; onDown?: () => void }) {
  const r = useTranslations("backlog.row");
  if (!onUp && !onDown) return null;
  return (
    <span className="flex shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={r("up")}
        onClick={onUp}
        disabled={!onUp}
        className="size-6"
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={r("down")}
        onClick={onDown}
        disabled={!onDown}
        className="size-6"
      >
        <ArrowDown />
      </Button>
    </span>
  );
}

/**
 * Done out of all, as a short bar and the numbers. Nothing to draw when
 * an item has no stories yet; the line says so in words instead.
 */
export function ProgressBar({
  progress,
  long,
  className,
}: {
  progress: Progress;
  /** The wider wording, "3 af 7 færdige", for the epic line. */
  long?: boolean;
  className?: string;
}) {
  const h = useTranslations("backlog.hierarchy");
  if (progress.total === 0) return null;
  const share = Math.round((progress.done / progress.total) * 100);
  return (
    <span
      className={cn("text-meta inline-flex shrink-0 items-center gap-2 text-[0.72rem]", className)}
      title={h("progress", { done: progress.done, total: progress.total })}
    >
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-label={h("progress", { done: progress.done, total: progress.total })}
        className={cn("bg-muted block h-1.5 overflow-hidden rounded-full", long ? "w-20" : "w-14")}
      >
        <span className="bg-primary block h-full rounded-full" style={{ width: `${share}%` }} />
      </span>
      <span className="tabular-nums whitespace-nowrap">
        {long
          ? h("progress", { done: progress.done, total: progress.total })
          : h("progressShort", { done: progress.done, total: progress.total })}
      </span>
    </span>
  );
}
