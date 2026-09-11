import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BoardView } from "@/components/board/board-view";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen } from "@/core/dates";
import { getBoardFull } from "@/modules/boards/read";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const context = await requireOrgContext();
  if (!context) return {};
  const { id } = await params;
  const full = await getBoardFull(context, id);
  return { title: full?.board.name };
}

/** The board: columns and cards, with the active sprint on top when there is one. */
export default async function BoardPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getBoardFull(context, id);
  if (!full) notFound();
  return <BoardView full={full} today={todayInCopenhagen()} />;
}
