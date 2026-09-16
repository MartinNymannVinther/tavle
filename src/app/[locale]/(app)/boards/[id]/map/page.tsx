import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { StoryMapView } from "@/components/map/story-map-view";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardFull } from "@/modules/boards/read";
import { redirect as localeRedirect } from "@/i18n/navigation";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

/** The story map: the decomposition across, the releases down. */
export default async function StoryMapPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  // A board of cards alone has no backbone to draw, and the tab is gone
  // from the nav for exactly that reason (docs/adr/0014). Reaching the
  // page by URL used to answer "no features yet" on a board with five of
  // them, and offer to make a sixth; it sends you back to the board now.
  if (full.board.structureLevels === "card") {
    localeRedirect({ href: `/boards/${id}`, locale: await getLocale() });
  }
  return <StoryMapView full={full} />;
}
