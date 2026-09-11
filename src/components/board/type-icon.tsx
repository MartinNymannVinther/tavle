"use client";

import { Bug, Flag, Puzzle, StickyNote, Wrench, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * One symbol per kind of thing, the same everywhere it appears: a flag
 * for an epic (a result to reach), a puzzle piece for a feature (a slice
 * of it), a note for a card (what sits on the board), a bug for a bug
 * and a wrench for enabler work. Each sits on its own tint so the eye
 * learns the pair, and each carries its word for assistive technology,
 * because meaning never rests on a shape or a colour alone.
 */
export type ItemType = "epic" | "feature" | "card" | "bug" | "enabler";

const GLYPH: Record<ItemType, LucideIcon> = {
  epic: Flag,
  feature: Puzzle,
  card: StickyNote,
  bug: Bug,
  enabler: Wrench,
};

const TINT: Record<ItemType, string> = {
  epic: "bg-accent text-accent-foreground",
  feature: "bg-muted text-secondary-foreground",
  card: "bg-card text-meta border-border border",
  bug: "bg-warning-tint text-warning",
  enabler: "bg-secondary text-secondary-foreground border-border border",
};

const SIZE = {
  sm: { box: "size-[1.125rem] rounded-[0.3rem]", glyph: "size-3" },
  md: { box: "size-6 rounded-md", glyph: "size-3.5" },
} as const;

export function TypeIcon({
  type,
  size = "sm",
  className,
}: {
  type: ItemType;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const t = useTranslations("boards.types");
  const Glyph = GLYPH[type];
  return (
    <span
      role="img"
      aria-label={t(type)}
      title={t(type)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZE[size].box,
        TINT[type],
        className,
      )}
    >
      <Glyph className={SIZE[size].glyph} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

/** The glyph alone, for chips and menus that carry their own word. */
export function TypeGlyph({ type, className }: { type: ItemType; className?: string }) {
  const Glyph = GLYPH[type];
  return <Glyph className={cn("size-3 shrink-0", className)} strokeWidth={2.25} aria-hidden />;
}
