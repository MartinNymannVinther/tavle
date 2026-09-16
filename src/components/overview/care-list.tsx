"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { TypeIcon } from "@/components/board/type-icon";
import type { Finding } from "@/modules/boards/structure/hygiene";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * What the backlog is waiting for, one line per finding (docs/adr/0031).
 * A line names the number, says what it means in a sentence, and folds
 * out to the rows themselves — every one a link to the thing, because
 * a page that only counts leaves the work where it was.
 */

const TONE: Record<string, string> = {
  decide: "bg-chart-3",
  tidy: "bg-chart-4",
  note: "bg-label",
};

export function CareList({
  findings,
  boardKey,
  boardId,
}: {
  findings: Finding[];
  boardKey: string;
  boardId: string;
}) {
  const t = useTranslations("care");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="divide-hairline divide-y">
      {findings.map((finding) => {
        const count = finding.items.length;
        const isOpen = open === finding.key;
        return (
          <li key={finding.key}>
            <button
              type="button"
              aria-expanded={isOpen}
              disabled={count === 0}
              onClick={() => setOpen(isOpen ? null : finding.key)}
              className={cn(
                "focus-ring flex w-full items-start gap-3 px-4 py-3 text-left",
                count > 0 && "hover:bg-accent/40",
              )}
            >
              <span
                aria-hidden
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[finding.tone])}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-reading font-medium">{t(`${finding.key}.title`)}</span>
                  {count > 0 && (
                    <span className="text-meta text-2sm tabular-nums">{t("count", { count })}</span>
                  )}
                </span>
                <span className="text-meta mt-0.5 block text-2sm">
                  {finding.measure
                    ? t(`${finding.key}.body`, finding.measure)
                    : t(`${finding.key}.body`, { count })}
                </span>
              </span>
              {count > 0 && (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "text-label mt-1 size-4 shrink-0 transition-transform duration-[120ms]",
                    isOpen && "rotate-90",
                  )}
                />
              )}
            </button>
            {isOpen && count > 0 && (
              <ol className="border-hairline divide-hairline mb-2 ml-9 mr-4 divide-y border-t">
                {finding.items.map((row) => (
                  <li key={`${row.level}-${row.id}`}>
                    <Link
                      href={
                        row.level === "card"
                          ? `/boards/${boardId}/cards/${row.number}`
                          : `/boards/${boardId}/items/${row.number}`
                      }
                      className="focus-ring hover:bg-accent/40 flex items-center gap-2 px-2 py-1.5 text-2sm"
                    >
                      <TypeIcon type={row.level} />
                      <span className="text-meta font-mono shrink-0 text-2xs tabular-nums">
                        {boardKey}-{row.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** When there is nothing to ask about, the page says so and stops. */
export function CareClear() {
  const t = useTranslations("care");
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="text-reading font-medium">{t("clear.title")}</p>
      <p className="text-meta text-2sm">{t("clear.body")}</p>
    </div>
  );
}

/** The one line a reader wants first: how much is waiting, and how long it would take. */
export function CareSummary({
  cards,
  points,
  unestimated,
  depth,
  unit,
  boardId,
}: {
  cards: number;
  points: number;
  unestimated: number;
  depth: number | null;
  unit: string;
  boardId: string;
}) {
  const t = useTranslations("care");
  return (
    <p className="text-meta flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2sm">
      <Link
        href={`/boards/${boardId}/backlog`}
        className="focus-ring text-foreground font-medium underline-offset-4 hover:underline"
      >
        {t("summary", { cards, points, unit })}
      </Link>
      {depth !== null && <span>· {t("depth", { sprints: depth })}</span>}
      {unestimated > 0 && <span>· {t("unweighed", { count: unestimated })}</span>}
    </p>
  );
}
