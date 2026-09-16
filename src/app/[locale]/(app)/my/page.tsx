import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FlagChip, Initials, Points, PriorityMark } from "@/components/board/bits";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/core/auth/guard";
import { formatPlanDate, todayInCopenhagen } from "@/core/dates";
import type { EstimateUnit, Priority } from "@/core/db/schema";
import { listMyCards } from "@/modules/boards/read-lists";
import { listEstimateUnits } from "@/modules/boards/read-units";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("my");
  return { title: t("title") };
}

/**
 * The person's own open cards across every board, grouped by board and
 * in board order, with the overdue ones marked. The morning page for
 * somebody on three boards.
 */
export default async function MyCardsPage() {
  const t = await getTranslations("my");
  const locale = await getLocale();
  const priorities = await getTranslations("boards.priority");
  const context = await requireOrgContext();
  const cards = context ? await listMyCards(context) : [];
  // The rows of three boards stand in one column here, so each estimate
  // has to wear its own board's unit (docs/adr/0030): "20" under a board
  // counting hours and "3" under one counting points are not comparable,
  // and nothing else on the row says which scale it is on.
  const units = context ? await listEstimateUnits(context) : new Map<string, EstimateUnit>();
  const today = todayInCopenhagen();
  const boards = [
    ...new Map(
      cards.map((c) => [c.boardId, { id: c.boardId, name: c.boardName, key: c.boardKey }]),
    ).values(),
  ];

  return (
    <div className="flex flex-col gap-[26px]">
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: cards.length })} />
      {cards.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyBody")} />
      ) : (
        boards.map((board) => (
          <section
            key={board.id}
            className="border-border bg-card rounded-xl border shadow-[var(--surface-shadow)]"
          >
            <header className="px-4 py-3">
              <Link
                href={`/boards/${board.id}`}
                className="text-base font-semibold hover:underline"
              >
                {board.name}
              </Link>
            </header>
            <ul className="border-hairline divide-hairline divide-y border-t">
              {cards
                .filter((card) => card.boardId === board.id)
                .map((card) => {
                  const overdue = Boolean(card.dueDate && card.dueDate < today);
                  return (
                    <li key={card.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="text-meta w-16 shrink-0 text-xs tabular-nums">
                        {card.boardKey}-{card.number}
                      </span>
                      <Link
                        href={`/boards/${card.boardId}/cards/${card.number}`}
                        className="min-w-0 flex-1 truncate font-medium hover:underline"
                      >
                        {card.title}
                      </Link>
                      <span className="text-meta hidden text-xs sm:inline">{card.columnName}</span>
                      <PriorityMark
                        priority={card.priority as Priority}
                        label={priorities(card.priority)}
                      />
                      <Points estimate={card.estimate} unit={units.get(board.id) ?? "points"} />
                      {card.blocked && <FlagChip tone="blocked">{t("blocked")}</FlagChip>}
                      {card.dueDate && (
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            overdue ? "text-destructive font-medium" : "text-meta",
                          )}
                        >
                          {formatPlanDate(card.dueDate, locale)}
                        </span>
                      )}
                      {card.assigneeName && <Initials name={card.assigneeName} />}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
