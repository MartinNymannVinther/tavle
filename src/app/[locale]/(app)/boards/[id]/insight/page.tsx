import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ThroughputChart, VelocityChart } from "@/components/charts/bar-charts";
import { BurndownChart } from "@/components/charts/burndown-chart";
import { FlowChart } from "@/components/charts/flow-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/core/auth/guard";
import { formatDateDa } from "@/core/dates";
import { boardInsight } from "@/modules/boards/metrics/read";
import { getBoardHeader } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("insight");
  return { title: t("title") };
}

/**
 * What the record says about the board. A Scrum board leads with the
 * sprint: the burndown of the one running and the velocity of the ones
 * closed. Every board gets the flow: throughput, cycle time and the
 * cumulative flow diagram. Every number is computed from the transition
 * log on request.
 */
export default async function InsightPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const [header, insight] = await Promise.all([
    getBoardHeader(context, id),
    boardInsight(context, id),
  ]);
  if (!header || !insight) notFound();
  const t = await getTranslations("insight");
  const scrum = header.board.mode === "scrum";

  const stat = (label: string, value: string, hint?: string) => (
    <div className="flex flex-col gap-0.5">
      <p className="text-label text-[0.72rem] font-medium">{label}</p>
      <p className="text-[1.375rem] leading-none font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-meta text-[0.72rem]">{hint}</p>}
    </div>
  );

  const sprintCards = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("burndownTitle")}</CardTitle>
          <CardDescription>
            {insight.activeBurndown
              ? t("burndownBody", {
                  name: insight.activeBurndown.sprint.name,
                  remaining: insight.activeBurndown.remainingNow,
                  committed: insight.activeBurndown.committed,
                  end: formatDateDa(insight.activeBurndown.sprint.endDate),
                })
              : t("burndownNone")}
          </CardDescription>
        </CardHeader>
        {insight.activeBurndown && (
          <CardContent>
            <BurndownChart data={insight.activeBurndown} ariaLabel={t("burndownTitle")} />
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("velocityTitle")}</CardTitle>
          <CardDescription>
            {insight.velocity.average === null
              ? t("velocityNone")
              : t("velocityBody", { average: insight.velocity.average })}
          </CardDescription>
        </CardHeader>
        {insight.velocity.bars.length > 0 && (
          <CardContent>
            <VelocityChart data={insight.velocity} ariaLabel={t("velocityTitle")} />
          </CardContent>
        )}
      </Card>
    </>
  );

  const flowCards = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("throughputTitle")}</CardTitle>
          <CardDescription>{t("throughputBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThroughputChart data={insight.throughput} ariaLabel={t("throughputTitle")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("flowTitle")}</CardTitle>
          <CardDescription>{t("flowBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FlowChart
            data={insight.flow}
            ariaLabel={t("flowTitle")}
            legend={{
              backlog: t("legend.backlog"),
              todo: t("legend.todo"),
              doing: t("legend.doing"),
              done: t("legend.done"),
            }}
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="grid gap-5 @lg:grid-cols-4">
          {stat(t("wip"), String(insight.wip), t("wipHint"))}
          {stat(
            t("cycle"),
            insight.cycle.medianDays === null ? "–" : t("days", { days: insight.cycle.medianDays }),
            insight.cycle.averageDays === null
              ? t("cycleNone")
              : t("cycleHint", {
                  average: insight.cycle.averageDays,
                  sample: insight.cycle.sample,
                }),
          )}
          {stat(
            t("lead"),
            insight.cycle.leadAverageDays === null
              ? "–"
              : t("days", { days: insight.cycle.leadAverageDays }),
            t("leadHint"),
          )}
          {stat(
            t("weekly"),
            String(insight.throughput.at(-1)?.count ?? 0),
            t("weeklyHint", {
              average:
                Math.round(
                  (insight.throughput.reduce((s, w) => s + w.count, 0) /
                    Math.max(1, insight.throughput.length)) *
                    10,
                ) / 10,
            }),
          )}
        </CardContent>
      </Card>
      {scrum && <div className="grid gap-5 @3xl:grid-cols-2">{sprintCards}</div>}
      <div className="grid gap-5 @3xl:grid-cols-2">{flowCards}</div>
    </div>
  );
}
