import type { LabelColor, Priority } from "@/core/db/schema";

/**
 * The few colours a board uses, all of them the family's tokens. Meaning
 * never rests on colour alone: every label carries its name, every
 * priority its word, every column its count.
 */

export const LABEL_STYLE: Record<LabelColor, string> = {
  moss: "bg-success-tint text-success",
  amber: "bg-warning-tint text-[color:var(--chart-4)]",
  rose: "bg-warning-tint text-destructive",
  sky: "bg-accent text-[color:var(--chart-2)]",
  plum: "bg-accent text-[color:var(--chart-5)]",
  slate: "bg-muted text-secondary-foreground",
};

/** A swatch for the label editor, where the colour is the thing being chosen. */
export const LABEL_SWATCH: Record<LabelColor, string> = {
  moss: "var(--success)",
  amber: "var(--chart-4)",
  rose: "var(--destructive)",
  sky: "var(--chart-2)",
  plum: "var(--chart-5)",
  slate: "var(--label)",
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"];

/** The small mark next to a title; "normal" has none, which is the point of it. */
export const PRIORITY_MARK: Record<Priority, { glyph: string; className: string } | null> = {
  urgent: { glyph: "!!", className: "text-destructive" },
  high: { glyph: "!", className: "text-[color:var(--chart-4)]" },
  normal: null,
  low: { glyph: "↓", className: "text-meta" },
};

export const CATEGORY_DOT: Record<string, string> = {
  backlog: "bg-label",
  todo: "bg-[color:var(--chart-2)]",
  doing: "bg-primary",
  done: "bg-success",
};
