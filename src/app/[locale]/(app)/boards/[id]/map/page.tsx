import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StoryMapView } from "@/components/map/story-map-view";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

/** The story map: the decomposition across, the sprints or columns down. */
export default async function StoryMapPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  return <StoryMapView full={full} />;
}
