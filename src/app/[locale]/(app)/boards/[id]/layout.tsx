import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardHeader } from "@/modules/boards/read";
import { BoardHeader } from "./board-header";

/**
 * Everything under a board shares its header: the name, how it is run,
 * and the tabs, full on the board's pages and one line on a card or an
 * item. The board itself is read once here through the
 * workspace's own context, so a board id from another workspace is
 * simply not there for any page below it.
 */
export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const header = await getBoardHeader(context, id);
  if (!header) notFound();
  const t = await getTranslations("boards.mode");
  const tabs = await getTranslations("boards.tabs");
  const { board } = header;

  return (
    <div className="flex flex-col gap-5">
      <BoardHeader
        boardId={board.id}
        kicker={`${board.key} · ${t(board.mode)}${board.archivedAt ? ` · ${tabs("archived")}` : ""}`}
        name={board.name}
        description={board.description || undefined}
        scrum={board.mode === "scrum"}
      />
      {children}
    </div>
  );
}
