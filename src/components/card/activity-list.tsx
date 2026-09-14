"use client";

import { Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { BoardEvent } from "@/core/db/schema";
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
}: {
  events: BoardEvent[];
  /** Runs the event's reverse; absent, the feed is read-only. */
  onUndo?: (eventId: string) => void;
}) {
  const t = useTranslations("cards.activity");
  const lines = useTranslations("events");
  const format = useFormatter();
  if (events.length === 0) return null;
  const undone = new Set(
    events
      .filter((event) => event.type === "undo.applied")
      .map((event) => String((event.payload as { of?: unknown }).of ?? "")),
  );
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
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
                {renderEvent(lines, event)}
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
                  onClick={() => onUndo!(event.id)}
                  className="text-meta hover:text-foreground h-6 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/event:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                >
                  <Undo2 data-slot="icon" />
                  {t("undo")}
                </Button>
              )}
              <time dateTime={event.createdAt.toISOString()} className="tabular-nums">
                {format.dateTime(event.createdAt, { dateStyle: "short", timeStyle: "short" })}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
