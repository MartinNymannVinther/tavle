"use client";

import { Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatStamp } from "@/core/dates";
import type { BoardEvent, EstimateUnit } from "@/core/db/schema";
import { renderEvent } from "@/modules/boards/events";
import { cn } from "@/lib/utils";

/**
 * What happened, newest first, rendered from structured events into
 * sentences in the reader's language. The AI's own changes are marked,
 * and an event that carries its own reverse (docs/adr/0022) carries a
 * "Fortryd" — until it has been undone, which the feed then also says,
 * because an undo is a new action, never an erasure.
 */
export function ActivityList({
  events,
  onUndo,
  heading,
  unit,
}: {
  events: BoardEvent[];
  /**
   * Runs the event's reverse; absent, the feed is read-only. The event's
   * type comes along because some reverses take the page with them — the
   * reverse of a creation is a deletion.
   */
  onUndo?: (eventId: string, type: string) => void;
  /** Its own heading; null where the surface around it already has one. */
  heading?: string | null;
  /** What the board counts in, so an old line is read in today's words. */
  unit?: EstimateUnit;
}) {
  const t = useTranslations("cards.activity");
  const lines = useTranslations("events");
  const locale = useLocale();
  if (events.length === 0) return null;
  const undone = new Set(
    events
      .filter((event) => event.type === "undo.applied")
      .map((event) => String((event.payload as { of?: unknown }).of ?? "")),
  );
  return (
    <section className="flex flex-col gap-2">
      {heading !== null && <h2 className="text-sm font-semibold">{heading ?? t("title")}</h2>}
      <ol className="border-hairline flex flex-col divide-y">
        {events.map((event) => {
          const wasUndone = undone.has(event.id);
          const canUndo =
            Boolean(onUndo) &&
            !wasUndone &&
            event.type !== "undo.applied" &&
            Boolean((event.payload as { undo?: unknown }).undo);
          return (
            <li
              key={event.id}
              className="text-meta group/event flex flex-wrap items-baseline gap-x-3 py-1.5 text-2sm"
            >
              <span
                className={cn("text-foreground/80 min-w-0 flex-1", wasUndone && "line-through")}
              >
                {renderEvent(lines, event, { unit })}
                {event.actorKind === "ai" && (
                  <span className="bg-accent text-accent-foreground ml-2 rounded-full px-1.5 py-0.5 text-2xs font-medium">
                    {t("byAi")}
                  </span>
                )}
              </span>
              {canUndo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onUndo!(event.id, event.type)}
                  className="text-meta hover:text-foreground h-6 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/event:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                >
                  <Undo2 data-slot="icon" />
                  {t("undo")}
                </Button>
              )}
              <time dateTime={event.createdAt.toISOString()} className="tabular-nums">
                {formatStamp(event.createdAt, locale)}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
