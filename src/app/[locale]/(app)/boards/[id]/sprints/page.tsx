import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VelocityChart } from "@/components/charts/bar-charts";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgContext } from "@/core/auth/guard";
import { formatDateDa } from "@/core/dates";
import { velocity } from "@/modules/boards/metrics/velocity";
import { getBoardHeader, listSprints } from "@/modules/boards/read";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sprints");
  return { title: t("title") };
}

/** Every sprint the board has run, newest first, and the velocity they add up to. */
export default async function SprintsPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const header = await getBoardHeader(context, id);
  if (!header || header.board.mode !== "scrum") notFound();
  const t = await getTranslations("sprints");
  const states = await getTranslations("sprints.state");
  const sprints = await listSprints(context, id);
  const v = velocity(sprints);

  return (
    <div className="flex flex-col gap-5">
      {v.bars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("velocityTitle")}</CardTitle>
            <CardDescription>
              {t("velocityBody", { unit: header.board.estimateUnit, average: v.average ?? 0 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VelocityChart data={v} ariaLabel={t("velocityTitle")} />
          </CardContent>
        </Card>
      )}
      {sprints.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyBody")}
          action={
            <Link href={`/boards/${id}/backlog`} className={buttonVariants({ size: "sm" })}>
              {t("emptyCta")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sprints.map((sprint) => (
            <li key={sprint.id}>
              <Link
                href={`/boards/${id}/sprints/${sprint.id}`}
                className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 shadow-[var(--surface-shadow)] transition focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-chart-2 text-xs font-medium">
                    {formatDateDa(sprint.startDate)} – {formatDateDa(sprint.endDate)}
                  </p>
                  <p className="truncate text-base font-semibold">{sprint.name}</p>
                  {sprint.goal && <p className="text-meta truncate text-sm">{sprint.goal}</p>}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-2xs font-medium",
                    sprint.state === "active" && "bg-accent text-accent-foreground",
                    sprint.state === "planned" && "bg-muted text-secondary-foreground",
                    sprint.state === "closed" && "bg-success-tint text-success",
                  )}
                >
                  {states(sprint.state)}
                </span>
                <p className="text-meta w-32 text-right text-sm tabular-nums">
                  {sprint.state === "closed"
                    ? t("closedPoints", {
                        unit: header.board.estimateUnit,
                        completed: sprint.completedPoints ?? 0,
                        committed: sprint.committedPoints ?? 0,
                      })
                    : sprint.state === "active"
                      ? t("committedPoints", {
                          unit: header.board.estimateUnit,
                          committed: sprint.committedPoints ?? 0,
                        })
                      : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
