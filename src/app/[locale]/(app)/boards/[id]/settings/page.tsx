import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BoardSettings } from "@/components/settings/board-settings";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext } from "@/core/db/tenant";
import { canManage, roleOf } from "@/modules/boards/members";
import { lastUndoableBoardEvent } from "@/modules/boards/events";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("boardSettings");
  return { title: t("title") };
}

export default async function BoardSettingsPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  const [role, lastUnitChange] = await withOrgContext(
    context,
    async (tx) =>
      [
        await roleOf(tx, context),
        await lastUndoableBoardEvent(tx, id, "board.estimateUnit"),
      ] as const,
  );
  return <BoardSettings full={full} canManage={canManage(role)} lastUnitChange={lastUnitChange} />;
}
