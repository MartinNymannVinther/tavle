import type { Priority, Theme } from "@/core/db/schema";
import { cn } from "@/lib/utils";
import { PRIORITY_MARK, themeSwatch } from "./tokens";
import { TypeGlyph } from "./type-icon";

const chip =
  "inline-flex h-5 max-w-[11rem] items-center gap-1 truncate rounded-full px-2 text-[0.69rem] font-medium";

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
 * a tint; a business story shows nothing.
 */
export function FlagChip({
  tone,
  children,
  className,
}: {
  tone: "bug" | "enabler";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        chip,
        tone === "bug" ? "bg-warning-tint text-warning" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <TypeGlyph type={tone} />
      {children}
    </span>
  );
}

/** The priority as a glyph with the word for assistive technology. */
export function PriorityMark({ priority, label }: { priority: Priority; label: string }) {
  const mark = PRIORITY_MARK[priority];
  if (!mark) return null;
  return (
    <span
      className={cn("text-[0.75rem] font-semibold", mark.className)}
      title={label}
      aria-label={label}
    >
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
        "bg-accent text-accent-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** Story points, when there are any. */
export function Points({ estimate, className }: { estimate: number | null; className?: string }) {
  if (estimate === null || estimate === undefined) return null;
  return (
    <span
      className={cn(
        "bg-muted text-secondary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.69rem] font-semibold tabular-nums",
        className,
      )}
    >
      {estimate}
    </span>
  );
}
