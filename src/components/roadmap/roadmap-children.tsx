"use client";

import { useTranslations } from "next-intl";
import { Points } from "@/components/board/bits";
import { TypeIcon } from "@/components/board/type-icon";
import type { BoardFull } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * What an unfolded epic holds on the roadmap: its features, and the
 * cards under each. Quiet, indented rows — no bars, because features
 * and cards have no quarters; the read is "what is this epic made of
 * and how far is it", one link from anything.
 */
export function RoadmapChildren({ epicId, full }: { epicId: string; full: BoardFull }) {
  const t = useTranslations("roadmap");
  const nav = useTranslations("backlog.nav");
  const boardId = full.board.id;
  const key = full.board.key;
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const features = full.items
    .filter((i) => i.level === "feature" && i.parentId === epicId)
    .sort((a, b) => a.sort - b.sort || a.number - b.number);

  if (features.length === 0) {
    return (
      <p className="text-meta bg-secondary/20 px-4 py-2 pl-12 text-[0.78rem]">
        {nav("noFeatures")}
      </p>
    );
  }

  return (
    <div className="bg-secondary/20 divide-hairline flex flex-col divide-y">
      {features.map((feature) => {
        const cards = full.cards
          .filter((c) => c.featureId === feature.id)
          .sort((a, b) => a.sort - b.sort || a.number - b.number);
        const done = cards.filter((c) => category.get(c.columnId) === "done").length;
        return (
          <div key={feature.id} className="flex flex-col py-1">
            <p className="flex items-center gap-2 py-1 pr-4 pl-12 text-[0.8125rem]">
              <TypeIcon type="feature" />
              <span className="text-meta font-mono shrink-0 text-[0.72rem] tabular-nums">
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
              <span className="text-meta shrink-0 text-[0.72rem] tabular-nums">
                {t("featureCards", { done, total: cards.length })}
              </span>
            </p>
            {cards.map((card) => {
              const cardDone = category.get(card.columnId) === "done";
              return (
                <p
                  key={card.id}
                  className="flex items-center gap-2 py-0.5 pr-4 pl-20 text-[0.78rem]"
                >
                  <TypeIcon type={card.bug ? "bug" : "card"} />
                  <span className="text-meta font-mono shrink-0 text-[0.69rem] tabular-nums">
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
                  <Points estimate={card.estimate} />
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
