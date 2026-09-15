import type { Priority, Theme } from "@/core/db/schema";
import { cn } from "@/lib/utils";
import type { EstimateUnit } from "@/core/db/schema";
import { labelOf } from "@/modules/boards/estimates";
import { PRIORITY_MARK, themeSwatch } from "./tokens";
import { TypeGlyph } from "./type-icon";

const chip =
  "inline-flex h-5 max-w-[11rem] items-center gap-1 truncate rounded-full px-2 text-2xs font-medium";

/**
 * The one status pill: closed things wear the success tint, things that
 * ask for a look wear the warning tint — the same two chips on every
 * page, never hand-rolled hues that drift apart in dark mode.
 */
export function StatusChip({
  tone,
  className,
  children,
}: {
  tone: "success" | "warning";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        chip,
        tone === "success" ? "bg-success-tint text-success" : "bg-warning-tint text-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A theme as a small pill with its colour as a dot; the name is always written out. */
export function ThemeChip({
  theme,
  className,
}: {
  theme: Pick<Theme, "name" | "color">;
  className?: string;
}) {
  return (
    <span className={cn(chip, "bg-muted text-secondary-foreground", className)}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: themeSwatch(theme.color) }}
      />
      <span className="truncate">{theme.name}</span>
    </span>
  );
}

/**
 * A card's themes as dots alone, for the board, where a chip per theme
 * per card is noise: each dot carries its name for the pointer and for
 * assistive technology, and the board's legend spells the pairs out.
 */
export function ThemeDots({
  themes,
  className,
}: {
  themes: Array<Pick<Theme, "id" | "name" | "color">>;
  className?: string;
}) {
  if (themes.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {themes.map((theme) => (
        <span
          key={theme.id}
          role="img"
          aria-label={theme.name}
          title={theme.name}
          className="size-2 rounded-full"
          style={{ background: themeSwatch(theme.color) }}
        />
      ))}
    </span>
  );
}

/** An area, plain: it answers where, and needs no colour to do it. */
export function AreaChip({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn(chip, "bg-accent text-accent-foreground", className)}>
      <span className="truncate">{name}</span>
    </span>
  );
}

/**
 * The bug flag and the enabler kind, as the type's symbol and its word on
 * a tint; a business story shows nothing. "Blocked" is a state, not a
 * kind, and carries the word alone.
 */
export function FlagChip({
  tone,
  children,
  className,
}: {
  tone: "bug" | "enabler" | "blocked";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        chip,
        tone === "enabler"
          ? "bg-secondary text-secondary-foreground"
          : "bg-warning-tint text-warning",
        className,
      )}
    >
      {tone !== "blocked" && <TypeGlyph type={tone} />}
      {children}
    </span>
  );
}

/** The priority as a glyph with the word for assistive technology. */
export function PriorityMark({ priority, label }: { priority: Priority; label: string }) {
  const mark = PRIORITY_MARK[priority];
  if (!mark) return null;
  return (
    <span className={cn("text-xs font-semibold", mark.className)} title={label} aria-label={label}>
      {mark.glyph}
    </span>
  );
}

/** Two letters for a person, on the accent ground. */
export function Initials({
  name,
  className,
  title,
}: {
  name: string;
  className?: string;
  title?: string;
}) {
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={cn(
        "bg-accent text-accent-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** The card's size, in whatever the board counts in (docs/adr/0030). */
export function Points({
  estimate,
  unit = "points",
  className,
}: {
  estimate: number | null;
  unit?: EstimateUnit;
  className?: string;
}) {
  const label = labelOf(estimate, unit);
  if (label === null) return null;
  return (
    <span
      className={cn(
        "bg-muted text-secondary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold",
        // A size is a word, not a number; only digits want tabular figures.
        unit === "tshirt" ? "tracking-tight" : "tabular-nums",
        className,
      )}
    >
      {label}
    </span>
  );
}
