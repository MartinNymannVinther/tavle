"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NativeSelect } from "@/components/ui/native-select";
import { PropertyGroup, PropertyRow } from "@/components/ui/property-row";
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
import { cn } from "@/lib/utils";
import { panel, surface } from "@/components/ui/detail-surfaces";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
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
          <span className="font-mono tabular-nums">
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
          <div className="border-warning bg-warning-tint/40 mt-1 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
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

      <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={surface}>
          <ItemTextarea item={item} field="doneWhen" run={run} />
          <ItemTextarea item={item} field="description" run={run} />
          <ItemChildren full={full} run={run} />
          <ActivityList events={events} />
        </div>
        <aside className={cn(panel, "@3xl:sticky @3xl:top-6")}>
          <PropertyGroup>
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
          </PropertyGroup>
          {epic && (
            <PropertyGroup>
              <PropertyRow label={s("targetQuarter")} htmlFor="item-quarter">
                <NativeSelect
                  id="item-quarter"
                  variant="xs"
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
              </PropertyRow>
            </PropertyGroup>
          )}
          <div className="border-hairline text-meta flex flex-col gap-0.5 border-t px-4 py-3 text-[0.72rem]">
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
          <div className="border-hairline flex flex-wrap gap-2 border-t px-4 py-3">
            {item.state === "closed" ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
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
                size="xs"
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
          <TypeLegend
            types={["epic", "feature", "card", "bug"]}
            className="border-hairline border-t px-4 py-2"
          />
        </aside>
      </div>
    </div>
  );
}
