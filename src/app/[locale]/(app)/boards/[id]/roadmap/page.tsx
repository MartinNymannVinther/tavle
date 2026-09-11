import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardFull } from "@/modules/boards/read";

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
  return <RoadmapView full={full} />;
}
