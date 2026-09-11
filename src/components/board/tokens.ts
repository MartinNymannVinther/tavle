import type { Priority, ThemeColor } from "@/core/db/schema";

/**
 * The few colours a board uses, all of them the family's tokens. Meaning
 * never rests on colour alone: every theme carries its name, every
 * priority its word, every column its count.
 */

/**
 * A theme's colour on the roadmap and as the dot on its chip. Eight
 * values from the 2a palette, greens and clays and greys, because the
 * family has no other hues and a roadmap in eight garish colours is not
 * this product.
 */
export const THEME_SWATCH: Record<ThemeColor, string> = {
  moss: "var(--primary)",
  sage: "var(--chart-2)",
  clay: "var(--chart-4)",
  rust: "var(--destructive)",
  sand: "var(--chart-3)",
  stone: "var(--label)",
  ink: "var(--foreground)",
  forest: "var(--primary-active)",
};

export const themeSwatch = (color: string) =>
  THEME_SWATCH[color as ThemeColor] ?? THEME_SWATCH.moss;

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
