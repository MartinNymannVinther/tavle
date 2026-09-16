import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/core/auth/guard";
import { modelConfigured } from "@/modules/ai/service";
import { formatPlanDate } from "@/core/dates";
import { listBoards } from "@/modules/boards/read-lists";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NewBoardDialog } from "./new-board-dialog";
import { PasskeyPrompt } from "./passkey-prompt";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("boards.list");
  return { title: t("title") };
}

/**
 * The home of the app: every board in the workspace, with what a glance
 * needs — how it is run, how much is open, how much is in progress, and
 * for a Scrum board which sprint it is in. Archived boards sit below the
 * live ones and can be brought back from their settings.
 */
export default async function BoardsPage() {
  const t = await getTranslations("boards.list");
  const locale = await getLocale();
  const modes = await getTranslations("boards.mode");
  const context = await requireOrgContext();
  const boards = context ? await listBoards(context) : [];
  const aiAvailable = context ? await modelConfigured(context) : false;
  const live = boards.filter((b) => !b.archivedAt);
  const archived = boards.filter((b) => b.archivedAt);

  return (
    <div className="flex flex-col gap-[26px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<NewBoardDialog aiAvailable={aiAvailable} />}
      />
      <PasskeyPrompt />

      {live.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyBody")}
          action={<NewBoardDialog aiAvailable={aiAvailable} />}
        />
      ) : (
        <ul className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {live.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring block h-full rounded-xl border p-4 shadow-[var(--surface-shadow)] transition focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{board.name}</h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs font-medium",
                      board.mode === "scrum"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-secondary-foreground",
                    )}
                  >
                    {modes(board.mode)}
                  </span>
                </div>
                <p className="text-meta mt-0.5 text-xs tabular-nums">{board.key}</p>
                {board.description && (
                  <p className="text-meta mt-2 line-clamp-2 text-sm">{board.description}</p>
                )}
                <p className="text-meta mt-3 text-xs">
                  {t("counts", {
                    open: board.openCount,
                    doing: board.inProgressCount,
                    done: board.doneCount,
                  })}
                </p>
                <p className="mt-1 text-xs">
                  {board.mode === "scrum" ? (
                    board.activeSprint ? (
                      <span className="text-foreground">
                        {t("activeSprint", {
                          name: board.activeSprint.name,
                          date: formatPlanDate(board.activeSprint.endDate, locale),
                        })}
                      </span>
                    ) : (
                      <span className="text-meta">{t("noSprint")}</span>
                    )
                  ) : (
                    <span className="text-meta">{t("flow")}</span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-sm font-medium">{t("archived")}</h2>
          <ul className="flex flex-wrap gap-2">
            {archived.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/boards/${board.id}/settings`}
                  className="border-border text-meta hover:text-foreground rounded-full border px-3 py-1 text-xs"
                >
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
