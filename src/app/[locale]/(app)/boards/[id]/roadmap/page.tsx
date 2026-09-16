import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { requireOrgContext } from "@/core/auth/guard";
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
  return <RoadmapView full={full} />;
}
