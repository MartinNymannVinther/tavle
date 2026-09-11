import type { Label, LabelColor, Priority } from "@/core/db/schema";
import { cn } from "@/lib/utils";
import { LABEL_STYLE, PRIORITY_MARK } from "./tokens";

/** A label as a small tinted pill; the name is always written out. */
export function LabelChip({
  label,
  className,
}: {
  label: Pick<Label, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-[10rem] items-center truncate rounded-full px-2 text-[0.69rem] font-medium",
        LABEL_STYLE[label.color as LabelColor] ?? LABEL_STYLE.slate,
        className,
      )}
    >
      {label.name}
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
