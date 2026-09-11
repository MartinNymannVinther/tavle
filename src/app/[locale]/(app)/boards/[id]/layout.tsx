import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/core/auth/guard";
import { getBoardHeader } from "@/modules/boards/read";
import { BoardTabs } from "./board-tabs";

/**
 * Everything under a board shares its header: the name, how it is run,
 * and the tabs. The board itself is read once here through the
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
      <PageHeader
        size="detail"
        kicker={`${board.key} · ${t(board.mode)}${board.archivedAt ? ` · ${tabs("archived")}` : ""}`}
        title={board.name}
        subtitle={board.description || undefined}
        actions={<BoardTabs boardId={board.id} scrum={board.mode === "scrum"} />}
      />
      {children}
    </div>
  );
}
