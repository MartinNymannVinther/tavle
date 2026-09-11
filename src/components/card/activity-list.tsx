"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { BoardEvent } from "@/core/db/schema";
import { renderEvent } from "@/modules/boards/events";

/**
 * What happened to the card, newest first, rendered from structured
 * events into sentences in the reader's language. The AI's own changes
 * are marked, because a team should always be able to see which lines a
 * model wrote.
 */
export function ActivityList({ events }: { events: BoardEvent[] }) {
  const t = useTranslations("cards.activity");
  const lines = useTranslations("events");
  const format = useFormatter();
  if (events.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <ol className="border-hairline flex flex-col divide-y">
        {events.map((event) => (
          <li
            key={event.id}
            className="text-meta flex flex-wrap items-baseline gap-x-3 py-1.5 text-[0.78rem]"
          >
            <span className="text-foreground/80 min-w-0 flex-1">
              {renderEvent(lines, event)}
              {event.actorKind === "ai" && (
                <span className="bg-accent text-accent-foreground ml-2 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium">
                  {t("byAi")}
                </span>
              )}
            </span>
            <time dateTime={event.createdAt.toISOString()} className="tabular-nums">
              {format.dateTime(event.createdAt, { dateStyle: "short", timeStyle: "short" })}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
