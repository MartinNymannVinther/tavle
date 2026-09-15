"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { StatusChip } from "@/components/board/bits";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NativeSelect } from "@/components/ui/native-select";
import { PropertyGroup, PropertyRow } from "@/components/ui/property-row";
import { FeaturePlanFields } from "./feature-plan-fields";
import { ActivityList } from "@/components/card/activity-list";
import { StructureFields } from "@/components/card/placement-fields";
import { quarterOptions } from "@/components/backlog/quarters";
import { TypeIcon } from "@/components/board/type-icon";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { structureView } from "@/modules/boards/structure/view";
import { useBoardActions } from "@/components/board/use-board-actions";
import { proposeReviewBriefAction } from "@/modules/ai/actions-advice";
import type { ReviewBrief } from "@/modules/ai/advice";
import { undoEventAction } from "@/modules/boards/actions-undo";
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
export function ItemPage({
  full,
  canManage,
  aiAvailable = false,
}: {
  full: ItemFull;
  canManage: boolean;
  aiAvailable?: boolean;
}) {
  const t = useTranslations("items.page");
  const s = useTranslations("boards.structure");
  const ai = useTranslations("cards.ai");
  const format = useFormatter();
  const router = useRouter();
  const { run } = useBoardActions();
  const { item, board, parent, themes, areas, epics, openFeatures, events, reviewDue } = full;
  const epic = item.level === "epic";
  const categoryNames = [...themes.map((x) => x.name), ...areas.map((a) => a.name)];
  const backlog = `/boards/${board.id}/backlog`;
  const view = structureView(board);
  // The review brief (docs/adr/0026): a read the model writes and no one
  // applies — the banner's decision stays a human button.
  const [brief, setBrief] = useState<(ReviewBrief & { engine: string }) | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefFailure, setBriefFailure] = useState<string | null>(null);

  async function fetchBrief() {
    setBriefBusy(true);
    setBriefFailure(null);
    const result = await proposeReviewBriefAction({ itemId: item.id });
    setBriefBusy(false);
    if (!result.ok) {
      setBriefFailure(result.error);
      return;
    }
    setBrief({ ...result.proposal, engine: result.engine });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-meta flex flex-wrap items-center gap-2 text-2sm">
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
          {item.state === "closed" && <StatusChip tone="success">{t("closed")}</StatusChip>}
          {reviewDue && <StatusChip tone="warning">{s("forReview")}</StatusChip>}
        </p>
        <ItemTitle item={item} categoryNames={categoryNames} run={run} />
        {reviewDue && (
          <div className="border-warning bg-warning-tint/40 mt-1 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <p className="min-w-0 flex-1">{t("reviewBody", { days: board.epicReviewDays })}</p>
            {aiAvailable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={briefBusy}
                onClick={() => void fetchBrief()}
              >
                <Sparkles data-slot="icon" />
                {t("reviewBrief")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => void run(() => confirmReviewAction({ itemId: item.id }))}
            >
              {t("reviewConfirm")}
            </Button>
          </div>
        )}
        {briefFailure && <p className="text-destructive text-xs">{ai(`errors.${briefFailure}`)}</p>}
        {brief && (
          <div className="border-hairline bg-card mt-1 flex flex-col gap-2 rounded-lg border p-3 text-sm shadow-[var(--surface-shadow)]">
            <p className="leading-relaxed whitespace-pre-wrap">{brief.summary}</p>
            {brief.observations.length > 0 && (
              <ul className="text-2sm flex list-disc flex-col gap-0.5 pl-5">
                {brief.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            )}
            <p className="text-meta text-2xs">{ai("engine", { engine: brief.engine })}</p>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={surface}>
          <ItemTextarea item={item} field="doneWhen" run={run} assist={aiAvailable} />
          <ItemTextarea item={item} field="description" run={run} />
          <ItemChildren full={full} run={run} />
          <ActivityList
            events={events}
            onUndo={(eventId) => void run(() => undoEventAction({ eventId }))}
          />
        </div>
        <aside className={cn(panel, "@3xl:sticky @3xl:top-6")}>
          <PropertyGroup>
            <StructureFields
              parent={
                epic || !view.epics
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
              view={view}
              onPlace={(placement) =>
                void run(() => placeItemAction({ itemId: item.id, ...placement }))
              }
              onKind={(fields) => void run(() => updateItemAction({ itemId: item.id, ...fields }))}
            />
          </PropertyGroup>
          {!epic && board.mode === "scrum" && full.sprints.length > 0 && (
            <PropertyGroup>
              <PropertyRow label={s("plannedSprints")}>
                <FeaturePlanFields item={item} sprints={full.sprints} run={run} />
              </PropertyRow>
            </PropertyGroup>
          )}
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
          <div className="border-hairline text-meta flex flex-col gap-0.5 border-t px-4 py-3 text-xs">
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
                aiAvailable={aiAvailable}
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
            types={legendTypes({ ...view, kind: false })}
            className="border-hairline border-t px-4 py-2"
          />
        </aside>
      </div>
    </div>
  );
}
