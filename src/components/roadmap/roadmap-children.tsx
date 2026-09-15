"use client";

import { useTranslations } from "next-intl";
import { FoldButton } from "@/components/backlog/backlog-bits";
import { useFolded } from "@/components/backlog/use-folded";
import { themeSwatch } from "@/components/board/tokens";
import { TypeIcon } from "@/components/board/type-icon";
import { quarterPosition } from "@/modules/boards/structure/roadmap";
import type { BoardFull, ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * What an unfolded epic holds on the roadmap: its features on the same
 * quarter axis as the epic's own bar, each drawn roughly where its
 * planned sprints lie (docs/adr/0023) — an unplanned feature says so
 * instead of pretending — and the cards under each behind a fold,
 * closed until asked, so the epic's shape stays one calm read.
 */
export function RoadmapChildren({
  epicId,
  full,
  quarters,
}: {
  epicId: string;
  full: BoardFull;
  quarters: string[];
}) {
  const t = useTranslations("roadmap");
  const nav = useTranslations("backlog.nav");
  const boardId = full.board.id;
  const folded = useFolded(`${boardId}:roadmapcards`);
  const key = full.board.key;
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const sprintOf = new Map(full.sprints.map((s) => [s.id, s]));
  const features = full.items
    .filter((i) => i.level === "feature" && i.parentId === epicId)
    .sort((a, b) => a.sort - b.sort || a.number - b.number);

  if (features.length === 0) {
    return (
      <p className="text-meta bg-secondary/20 px-4 py-2 pl-12 text-2sm">{nav("noFeatures")}</p>
    );
  }

  const barFor = (feature: ItemView) => {
    const start = feature.startSprintId ? sprintOf.get(feature.startSprintId) : null;
    const end = feature.targetSprintId ? sprintOf.get(feature.targetSprintId) : null;
    if (!start || !end) return null;
    const at = (date: string) => (quarterPosition(date, quarters) / quarters.length) * 100;
    // Pinned inside the strip: a plan past the horizon ends AT the last
    // quarter instead of painting a sliver beyond it.
    const right = Math.min(at(end.endDate), 100);
    const width = Math.max(right - at(start.startDate), 1.5);
    return {
      left: Math.min(at(start.startDate), 100 - width),
      width,
      title: `${start.name} – ${end.name}`,
    };
  };

  return (
    <div className="bg-secondary/20 divide-hairline flex flex-col divide-y">
      {features.map((feature) => {
        const cards = full.cards
          .filter((c) => c.featureId === feature.id)
          .sort((a, b) => a.sort - b.sort || a.number - b.number);
        const done = cards.filter((c) => category.get(c.columnId) === "done").length;
        const theme = feature.themeIds[0]
          ? (full.themes.find((th) => th.id === feature.themeIds[0]) ?? null)
          : null;
        const bar = barFor(feature);
        return (
          <div key={feature.id} className="flex flex-col py-1">
            <div
              className="grid items-center"
              style={{ gridTemplateColumns: "16rem minmax(0, 1fr)" }}
            >
              <p className="flex items-center gap-2 py-1 pr-4 pl-9 text-2sm">
                {cards.length > 0 ? (
                  <FoldButton
                    open={folded.isOpen(feature.id)}
                    onToggle={() => folded.toggle(feature.id)}
                  />
                ) : (
                  <span className="size-6 shrink-0" aria-hidden />
                )}
                <TypeIcon type="feature" />
                <span className="text-meta font-mono shrink-0 text-xs tabular-nums">
                  {key}-{feature.number}
                </span>
                <Link
                  href={`/boards/${boardId}/items/${feature.number}`}
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium hover:underline",
                    feature.state === "closed" && "text-meta line-through",
                  )}
                >
                  {feature.title}
                </Link>
                <span className="text-meta shrink-0 text-xs tabular-nums">
                  {t("featureCards", { done, total: cards.length })}
                </span>
              </p>
              <div className="relative h-7">
                <div
                  aria-hidden
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns: `repeat(${quarters.length}, minmax(0, 1fr))` }}
                >
                  {quarters.map((quarter) => (
                    <div key={quarter} className="border-hairline border-l" />
                  ))}
                </div>
                {bar ? (
                  <div
                    className={cn(
                      "absolute inset-y-2 rounded-full opacity-80",
                      feature.state === "closed" && "opacity-40",
                    )}
                    style={{
                      left: `calc(${bar.left}% + 0.25rem)`,
                      width: `calc(${bar.width}% - 0.25rem)`,
                      background: theme ? themeSwatch(theme.color) : "var(--label)",
                    }}
                    title={bar.title}
                  />
                ) : (
                  <span className="text-meta absolute inset-y-0 left-2 flex items-center text-2xs">
                    {t("featureUnplanned")}
                  </span>
                )}
              </div>
            </div>
            {folded.isOpen(feature.id) &&
              cards.map((card) => {
                const cardDone = category.get(card.columnId) === "done";
                return (
                  <p key={card.id} className="flex items-center gap-2 py-0.5 pr-4 pl-20 text-2sm">
                    <TypeIcon type={card.bug ? "bug" : "card"} />
                    <span className="text-meta font-mono shrink-0 text-2xs tabular-nums">
                      {key}-{card.number}
                    </span>
                    <Link
                      href={`/boards/${boardId}/cards/${card.number}`}
                      className={cn(
                        "min-w-0 flex-1 truncate hover:underline",
                        cardDone && "text-meta line-through",
                      )}
                    >
                      {card.title}
                    </Link>
                  </p>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
