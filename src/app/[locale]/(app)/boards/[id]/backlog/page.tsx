import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BacklogView } from "@/components/backlog/backlog-view";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backlog");
  return { title: t("title") };
}

/** Planning: the backlog and the sprints, Scrum boards only. */
export default async function BacklogPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full || full.board.mode !== "scrum") notFound();
  return <BacklogView full={full} />;
}
