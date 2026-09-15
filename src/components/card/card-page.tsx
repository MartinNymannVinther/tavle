"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { panel, surface } from "@/components/ui/detail-surfaces";
import { StatusChip } from "@/components/board/bits";
import { Button } from "@/components/ui/button";
import { TypeIcon } from "@/components/board/type-icon";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { structureView } from "@/modules/boards/structure/view";
import { useBoardActions } from "@/components/board/use-board-actions";
import { undoEventAction } from "@/modules/boards/actions-undo";
import type { CardFull } from "@/modules/boards/types";
import {
  archiveCardAction,
  deleteCardAction,
  restoreCardAction,
} from "@/modules/boards/actions-cards";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ActivityList } from "./activity-list";
import { AiPanel } from "./ai-panel";
import { CardAcceptance } from "./card-acceptance";
import { CardDescription } from "./card-description";
import { CardSidePanel } from "./card-side-panel";
import { CardTitle } from "./card-title";
import { ChecklistEditor } from "./checklist-editor";
import { CommentsPanel } from "./comments-panel";

/**
 * One card, whole. The words on the left, the facts on the right, the
 * history at the bottom. Everything saves as it is changed; the two
 * destructive things live at the very end behind a question.
 */
export function CardPage({
  full,
  currentUserId,
  canManage,
  aiAvailable,
}: {
  full: CardFull;
  currentUserId: string;
  canManage: boolean;
  aiAvailable: boolean;
}) {
  const t = useTranslations("cards.page");
  const format = useFormatter();
  const router = useRouter();
  const { run } = useBoardActions();
  const { card, board, columns, themes, areas, features, sprints, people, comments, events } = full;
  const column = columns.find((c) => c.id === card.columnId);
  const view = structureView(board);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-meta flex flex-wrap items-center gap-2 text-2sm">
          <Link href={`/boards/${board.id}`} className="hover:text-foreground">
            {board.name}
          </Link>
          <span aria-hidden>›</span>
          <TypeIcon type={card.bug ? "bug" : "card"} />
          <span className="font-mono tabular-nums">
            {board.key}-{card.number}
          </span>
          {column && (
            <>
              <span aria-hidden>·</span>
              <span>{column.name}</span>
            </>
          )}
          {card.archivedAt && <StatusChip tone="warning">{t("archived")}</StatusChip>}
        </p>
        <CardTitle card={card} run={run} />
      </div>

      <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={surface}>
          <CardDescription card={card} run={run} />
          <CardAcceptance card={card} run={run} />
          <ChecklistEditor card={card} run={run} />
          <AiPanel card={card} boardId={board.id} available={aiAvailable} run={run} />
          <CommentsPanel
            cardId={card.id}
            comments={comments}
            currentUserId={currentUserId}
            canManage={canManage}
            run={run}
          />
          <ActivityList
            events={events}
            onUndo={(eventId) => void run(() => undoEventAction({ eventId }))}
          />
        </div>
        <aside className={cn(panel, "@3xl:sticky @3xl:top-6")}>
          <CardSidePanel
            card={card}
            boardKey={board.key}
            columns={columns}
            themes={themes}
            areas={areas}
            features={features}
            sprints={sprints}
            people={people}
            scrum={board.mode === "scrum"}
            view={view}
            run={run}
          />
          <div className="border-hairline text-meta flex flex-col gap-0.5 border-t px-4 py-3 text-xs">
            <p>
              {t("created", { date: format.dateTime(card.createdAt, { dateStyle: "medium" }) })}
            </p>
            {card.startedAt && (
              <p>
                {t("started", { date: format.dateTime(card.startedAt, { dateStyle: "medium" }) })}
              </p>
            )}
            {card.doneAt && (
              <p>{t("done", { date: format.dateTime(card.doneAt, { dateStyle: "medium" }) })}</p>
            )}
          </div>
          <div className="border-hairline flex flex-wrap gap-2 border-t px-4 py-3">
            {card.archivedAt ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void run(() => restoreCardAction({ cardId: card.id }))}
              >
                {t("restore")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  void run(
                    () => archiveCardAction({ cardId: card.id }),
                    () => router.push(`/boards/${board.id}`),
                  )
                }
              >
                {t("archive")}
              </Button>
            )}
            <ConfirmButton
              size="xs"
              title={t("deleteTitle")}
              body={t("deleteBody", { key: `${board.key}-${card.number}` })}
              confirmLabel={t("deleteConfirm")}
              onConfirm={() =>
                run(
                  () => deleteCardAction({ cardId: card.id }),
                  () => router.push(`/boards/${board.id}`),
                )
              }
            >
              {t("delete")}
            </ConfirmButton>
          </div>
          <TypeLegend
            types={legendTypes({ ...view, epics: false, features: false })}
            className="border-hairline border-t px-4 py-2"
          />
        </aside>
      </div>
    </div>
  );
}
