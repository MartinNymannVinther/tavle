import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BacklogView } from "@/components/backlog/backlog-view";
import { requireOrgContext } from "@/core/auth/guard";
import { modelConfigured } from "@/modules/ai/service";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backlog");
  return { title: t("title") };
}

/** The backlog in its structure, and on a Scrum board the sprints beside it. */
export default async function BacklogPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  return <BacklogView full={full} aiAvailable={await modelConfigured(context)} />;
}
