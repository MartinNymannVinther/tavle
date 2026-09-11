"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NativeSelect } from "@/components/ui/native-select";
import { ActivityList } from "@/components/card/activity-list";
import { StructureFields } from "@/components/card/placement-fields";
import { quarterOptions } from "@/components/backlog/quarters";
import { TypeIcon } from "@/components/board/type-icon";
import { TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import {
  confirmReviewAction,
  deleteItemAction,
  placeItemAction,
  reopenItemAction,
  updateItemAction,
} from "@/modules/boards/actions-structure";
import type { ItemFull } from "@/modules/boards/structure/read";
import { Link, useRouter } from "@/i18n/navigation";
import { CloseItemButton } from "./close-dialog";
import { ItemChildren } from "./item-children";
import { ItemTextarea } from "./item-textarea";
import { ItemTitle } from "./item-title";

/**
 * One epic or feature, whole: the words on the left with what is under
 * it, the facts on the right. The marks the rules produce sit in the
 * header, and the review confirmation is a button next to the mark it
 * removes.
 */
export function ItemPage({ full, canManage }: { full: ItemFull; canManage: boolean }) {
  const t = useTranslations("items.page");
  const s = useTranslations("boards.structure");
  const format = useFormatter();
  const router = useRouter();
  const { run } = useBoardActions();
  const { item, board, parent, themes, areas, epics, openFeatures, events, reviewDue } = full;
  const epic = item.level === "epic";
  const categoryNames = [...themes.map((x) => x.name), ...areas.map((a) => a.name)];
  const backlog = `/boards/${board.id}/backlog`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-meta flex flex-wrap items-center gap-2 text-[0.78rem]">
          <Link href={backlog} className="hover:text-foreground">
            {board.name}
          </Link>
          {parent && (
            <>
              <span aria-hidden>›</span>
              <Link
                href={`/boards/${board.id}/items/${parent.number}`}
                className="hover:text-foreground"
              >
                {board.key}-{parent.number} · {parent.title}
              </Link>
            </>
          )}
          <span aria-hidden>›</span>
          <TypeIcon type={item.level as "epic" | "feature"} />
          <span className="tabular-nums">
            {board.key}-{item.number}
          </span>
          <span aria-hidden>·</span>
          <span>{s(`level.${item.level}`)}</span>
          {item.state === "closed" && (
            <span className="bg-success-tint text-success rounded-full px-2 py-0.5 text-[0.69rem] font-medium">
              {t("closed")}
            </span>
          )}
          {reviewDue && (
            <span className="bg-warning-tint text-warning rounded-full px-2 py-0.5 text-[0.69rem] font-medium">
              {s("forReview")}
            </span>
          )}
        </p>
        <ItemTitle item={item} categoryNames={categoryNames} run={run} />
        {reviewDue && (
          <div className="border-warning bg-warning-tint/40 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <p className="min-w-0 flex-1">{t("reviewBody", { days: board.epicReviewDays })}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => void run(() => confirmReviewAction({ itemId: item.id }))}
            >
              {t("reviewConfirm")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <ItemTextarea item={item} field="doneWhen" run={run} />
          <ItemTextarea item={item} field="description" run={run} />
          <ItemChildren full={full} run={run} />
          <ActivityList events={events} />
        </div>
        <aside className="flex flex-col gap-4 @3xl:sticky @3xl:top-6 @3xl:self-start">
          <StructureFields
            parent={
              epic
                ? null
                : {
                    label: s("epic"),
                    value: item.parentId,
                    options: epics,
                    boardKey: board.key,
                  }
            }
            areaId={item.areaId}
            themeIds={item.themeIds}
            kind={item.kind}
            enablerType={item.enablerType}
            themes={themes}
            areas={areas}
            offerCascade
            onPlace={(placement) =>
              void run(() => placeItemAction({ itemId: item.id, ...placement }))
            }
            onKind={(fields) => void run(() => updateItemAction({ itemId: item.id, ...fields }))}
          />
          {epic && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="item-quarter" className="text-label text-[0.72rem] font-medium">
                {s("targetQuarter")}
              </label>
              <NativeSelect
                id="item-quarter"
                variant="sm"
                value={item.targetQuarter ?? ""}
                onChange={(event) =>
                  void run(() =>
                    updateItemAction({
                      itemId: item.id,
                      targetQuarter: event.target.value || null,
                    }),
                  )
                }
              >
                <option value="">{s("noQuarter")}</option>
                {[...new Set([item.targetQuarter, ...quarterOptions()].filter(Boolean))].map(
                  (quarter) => (
                    <option key={quarter} value={quarter!}>
                      {quarter}
                    </option>
                  ),
                )}
              </NativeSelect>
            </div>
          )}
          <div className="text-meta flex flex-col gap-1 text-[0.72rem]">
            <p>
              {t("created", { date: format.dateTime(item.createdAt, { dateStyle: "medium" }) })}
            </p>
            {item.reviewConfirmedAt && (
              <p>
                {t("reviewed", {
                  date: format.dateTime(item.reviewConfirmedAt, { dateStyle: "medium" }),
                })}
              </p>
            )}
            {item.closedAt && (
              <p>
                {t("closedAt", { date: format.dateTime(item.closedAt, { dateStyle: "medium" }) })}
              </p>
            )}
          </div>
          <div className="border-hairline flex flex-wrap gap-2 border-t pt-4">
            {item.state === "closed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void run(() => reopenItemAction({ itemId: item.id }))}
              >
                {t("reopen")}
              </Button>
            ) : (
              <CloseItemButton
                item={item}
                boardKey={board.key}
                targets={epic ? epics : openFeatures}
                areas={areas}
                run={run}
              />
            )}
            {canManage && (
              <ConfirmButton
                title={t("deleteTitle")}
                body={t("deleteBody", { key: `${board.key}-${item.number}` })}
                confirmLabel={t("deleteConfirm")}
                onConfirm={() =>
                  run(
                    () => deleteItemAction({ itemId: item.id }),
                    () => router.push(backlog),
                  )
                }
              >
                {t("delete")}
              </ConfirmButton>
            )}
          </div>
          <TypeLegend types={["epic", "feature", "card", "bug"]} />
        </aside>
      </div>
    </div>
  );
}
