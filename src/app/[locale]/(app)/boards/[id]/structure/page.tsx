import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DecomposeView } from "@/components/structure/decompose-view";
import { requireOrgContext } from "@/core/auth/guard";
import { modelConfigured } from "@/modules/ai/service";
import { getBoardFull } from "@/modules/boards/read";
import { redirect as localeRedirect } from "@/i18n/navigation";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("decompose");
  return { title: t("title") };
}

/** The decomposition as a surface to build on: epics, features and cards, and the parentless tray. */
export default async function DecomposePage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  // Cards alone: there is nothing to decompose, and the nav says so by
  // leaving the tab out (docs/adr/0014).
  if (full.board.structureLevels === "card") {
    localeRedirect({ href: `/boards/${id}`, locale: await getLocale() });
  }
  return <DecomposeView full={full} aiAvailable={await modelConfigured(context)} />;
}
