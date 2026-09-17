import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext } from "@/core/db/tenant";
import { canManage, roleOf } from "@/modules/boards/members";
import { getBoardFull } from "@/modules/boards/read";
import { redirect as localeRedirect } from "@/i18n/navigation";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("roadmap");
  return { title: t("title") };
}

/** Epics on a line of quarters, coloured by theme. Computed from the board as it is. */
export default async function RoadmapPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  // The quarter axis is drawn from epics, and a Scrum board's sprint axis
  // from features; a board showing neither has no roadmap to draw, which
  // is why the nav leaves the tab out (docs/adr/0014, 0023).
  const roadmap =
    full.board.structureLevels === "epic" ||
    (full.board.mode === "scrum" && full.board.structureLevels !== "card");
  if (!roadmap) localeRedirect({ href: `/boards/${id}`, locale: await getLocale() });
  // A release's date is the board's shape, so the service asks for an
  // owner or an admin. The strip asks the same question before it draws
  // a grip, rather than offering a member a drag that would be refused.
  const role = await withOrgContext(context, (tx) => roleOf(tx, context));
  return <RoadmapView full={full} canManage={canManage(role)} />;
}
