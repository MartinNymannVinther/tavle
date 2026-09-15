"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Initials, Points } from "@/components/board/bits";
import { structureOf } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { TypeIcon } from "@/components/board/type-icon";
import type { Run } from "@/components/board/use-board-actions";
import { ItemForm, type ItemFormSource } from "@/components/backlog/item-form";
import { createCardAction } from "@/modules/boards/actions-cards";
import type { ItemFull } from "@/modules/boards/structure/read";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * What is under the item: an epic's features with how many stories each
 * has open and done, or a feature's stories with where each one is. New
 * children are made here so they start under the right parent and
 * inherit its area and themes.
 */
export function ItemChildren({ full, run }: { full: ItemFull; run: Run }) {
  const t = useTranslations("items.children");
  const { item, board, features, stories, doneStories, themes, areas, epics, openFeatures } = full;
  const epic = item.level === "epic";
  const source: ItemFormSource = { board, themes, areas, items: [...epics, ...openFeatures] };
  const estimateUnit = structureOf(source).estimateUnit;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {epic
            ? t("features", { count: features.length })
            : t("stories", { open: stories.length - doneStories, done: doneStories })}
        </h2>
        {epic && item.state === "open" && (
          <ItemForm
            full={source}
            level="feature"
            parentId={item.id}
            run={run}
            trigger={
              <Button type="button" variant="outline" size="sm">
                {t("newFeature")}
              </Button>
            }
          />
        )}
      </div>
      {epic ? (
        features.length === 0 ? (
          <p className="text-meta text-sm">{t("noFeatures")}</p>
        ) : (
          <ol className="border-hairline divide-hairline divide-y rounded-lg border">
            {features.map((feature) => (
              <li key={feature.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <TypeIcon type="feature" />
                <span className="text-meta font-mono shrink-0 text-xs tabular-nums">
                  {board.key}-{feature.number}
                </span>
                <Link
                  href={`/boards/${board.id}/items/${feature.number}`}
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium hover:underline",
                    feature.state === "closed" && "text-meta line-through",
                  )}
                >
                  {feature.title}
                </Link>
                <span className="text-meta text-xs tabular-nums">
                  {t("storyCounts", { open: feature.openStories, done: feature.doneStories })}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : stories.length === 0 ? (
        <p className="text-meta text-sm">{t("noStories")}</p>
      ) : (
        <ol className="border-hairline divide-hairline divide-y rounded-lg border">
          {stories.map((story) => (
            <li key={story.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <TypeIcon type={story.bug ? "bug" : "card"} />
              <span className="text-meta font-mono shrink-0 text-xs tabular-nums">
                {board.key}-{story.number}
              </span>
              <Link
                href={`/boards/${board.id}/cards/${story.number}`}
                className={cn(
                  "min-w-0 flex-1 truncate font-medium hover:underline",
                  story.category === "done" && "text-meta line-through",
                )}
              >
                {story.title}
              </Link>
              <span className="text-meta hidden text-xs sm:inline">{story.columnName}</span>
              <Points estimate={story.estimate} unit={estimateUnit} />
              {story.assigneeName ? (
                <Initials name={story.assigneeName} />
              ) : (
                <span className="size-6" />
              )}
            </li>
          ))}
        </ol>
      )}
      {!epic && item.state === "open" && (
        <QuickAdd
          onAdd={(title) =>
            run(() => createCardAction({ boardId: board.id, title, featureId: item.id }))
          }
          structure={structureOf(source)}
          fixed={{ featureId: item.id }}
        />
      )}
    </section>
  );
}
