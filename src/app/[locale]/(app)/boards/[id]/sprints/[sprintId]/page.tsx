import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { BurndownChart } from "@/components/charts/burndown-chart";
import { SprintNotes } from "@/components/sprint/sprint-notes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/core/auth/guard";
import { formatDateDa } from "@/core/dates";
import { cards, columns } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { modelConfigured } from "@/modules/ai/service";
import { sprintBurndown } from "@/modules/boards/metrics/read";
import { getBoardHeader, listSprints } from "@/modules/boards/read";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string; sprintId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const context = await requireOrgContext();
  if (!context) return {};
  const { id, sprintId } = await params;
  const sprint = (await listSprints(context, id)).find((s) => s.id === sprintId);
  return { title: sprint?.name };
}

/**
 * One sprint: its burndown, the cards it holds, and the two things the
 * team writes afterwards — the account of it, which a model can draft,
 * and the retro. A closed sprint keeps all of it as it was.
 */
export default async function SprintPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id, sprintId } = await params;
  const header = await getBoardHeader(context, id);
  const sprint = (await listSprints(context, id)).find((s) => s.id === sprintId);
  if (!header || !sprint) notFound();
  const t = await getTranslations("sprints.detail");
  const states = await getTranslations("sprints.state");
  const [burndown, rows, aiAvailable] = await Promise.all([
    sprintBurndown(context, sprint.id),
    withOrgContext(context, (tx) =>
      tx
        .select({
          id: cards.id,
          number: cards.number,
          title: cards.title,
          estimate: cards.estimate,
          category: columns.category,
          columnName: columns.name,
        })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.sprintId, sprint.id), isNull(cards.archivedAt)))
        .orderBy(asc(columns.sort), asc(cards.sort)),
    ),
    modelConfigured(context),
  ]);
  const done = rows.filter((r) => r.category === "done");
  const donePoints = done.reduce((s, r) => s + (r.estimate ?? 0), 0);
  const totalPoints = rows.reduce((s, r) => s + (r.estimate ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link href={`/boards/${id}/sprints`} className="text-meta hover:text-foreground text-sm">
          ‹ {t("back")}
        </Link>
        <h2 className="text-xl font-semibold">{sprint.name}</h2>
        <span className="text-meta text-sm">
          {formatDateDa(sprint.startDate)} – {formatDateDa(sprint.endDate)} · {states(sprint.state)}
        </span>
      </div>
      {sprint.goal && <p className="text-reading">{sprint.goal}</p>}

      <div className="grid gap-5 @3xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("burndownTitle")}</CardTitle>
            <CardDescription>
              {t("numbers", {
                unit: header.board.estimateUnit,
                done: done.length,
                total: rows.length,
                donePoints,
                totalPoints,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {burndown && sprint.state !== "planned" ? (
              <BurndownChart data={burndown} ariaLabel={t("burndownTitle")} />
            ) : (
              <p className="text-meta text-sm">{t("notStarted")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("cardsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-meta text-sm">{t("noCards")}</p>
            ) : (
              <ul className="divide-hairline flex flex-col divide-y">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="text-meta w-16 shrink-0 text-xs tabular-nums">
                      {header.board.key}-{row.number}
                    </span>
                    <Link
                      href={`/boards/${id}/cards/${row.number}`}
                      className={cn(
                        "min-w-0 flex-1 truncate hover:underline",
                        row.category === "done" && "text-meta line-through",
                      )}
                    >
                      {row.title}
                    </Link>
                    <span className="text-meta text-xs">{row.columnName}</span>
                    {row.estimate !== null && (
                      <span className="bg-muted rounded-full px-1.5 text-2xs font-semibold tabular-nums">
                        {row.estimate}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <SprintNotes sprint={sprint} boardId={id} aiAvailable={aiAvailable} />
    </div>
  );
}
