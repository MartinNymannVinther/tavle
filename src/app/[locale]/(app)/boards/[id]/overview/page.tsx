import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OverviewView } from "@/components/overview/overview-view";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overview");
  return { title: t("title") };
}

/** Where the open work sits and whether the structure is being kept. Computed on request. */
export default async function OverviewPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  return <OverviewView full={full} />;
}
