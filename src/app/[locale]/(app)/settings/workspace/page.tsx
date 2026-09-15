import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getOrgContext } from "@/core/auth/session";
import { formatDateDa } from "@/core/dates";
import { memberships, organizations } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { listPendingInvitations } from "@/core/team/service";
import { redirect } from "@/i18n/navigation";
import { peopleOf, unlinkedMembers } from "@/modules/boards/people";
import { currentRole, listMembers } from "@/modules/export/workspace";
import { DeleteWorkspaceCard } from "./delete-workspace-card";
import { MembersAdmin } from "./members-admin";
import { PeopleAdmin } from "./people-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.workspace");
  return { title: t("title") };
}

/**
 * The workspace itself: who is in it, how somebody else gets in, and the
 * way out. Deletion lives at the bottom, behind the workspace's own name
 * typed by hand, because it takes everything — the boards, the cards,
 * and the audit rows about them.
 */
export default async function WorkspaceSettingsPage() {
  const context = await getOrgContext();
  if (!context) {
    redirect({ href: "/login", locale: await getLocale() });
    return null;
  }

  const t = await getTranslations("settings.workspace");
  const [workspace, memberRows, roster, linkable] = await withOrgContext(context, async (tx) => {
    const [org] = await tx
      .select({ name: organizations.name, createdAt: organizations.createdAt })
      .from(organizations)
      .where(eq(organizations.id, context.orgId))
      .limit(1);
    const rows = await tx
      .select({ id: memberships.id, userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.organizationId, context.orgId));
    return [
      org,
      rows,
      await peopleOf(tx, context.orgId),
      await unlinkedMembers(tx, context),
    ] as const;
  });
  const members = await listMembers(context);
  const role = (await currentRole(context)) ?? "member";
  const invitations =
    role === "owner" || role === "admin" ? await listPendingInvitations(context.orgId) : [];

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold">{workspace?.name ?? t("title")}</h2>
        <p className="text-meta text-2sm leading-relaxed">
          {workspace
            ? t("createdOn", { date: formatDateDa(workspace.createdAt.toISOString().slice(0, 10)) })
            : t("subtitle")}
        </p>
      </div>

      <MembersAdmin
        members={members}
        memberIds={Object.fromEntries(memberRows.map((row) => [row.userId, row.id]))}
        invitations={invitations}
        currentUserId={context.userId}
        role={role}
      />

      <PeopleAdmin
        people={roster.map(({ id, name, email, userId }) => ({ id, name, email, userId }))}
        linkable={linkable}
        canManage={role === "owner" || role === "admin"}
      />

      {role === "owner" && workspace && <DeleteWorkspaceCard workspaceName={workspace.name} />}
    </div>
  );
}
