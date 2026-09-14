import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CardPage } from "@/components/card/card-page";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext } from "@/core/db/tenant";
import { modelConfigured } from "@/modules/ai/service";
import { canManage, roleOf } from "@/modules/boards/members";
import { getCardFull } from "@/modules/boards/read";
import { cardTitle } from "@/modules/boards/read-titles";

type Params = { params: Promise<{ id: string; number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const context = await requireOrgContext();
  if (!context) return {};
  const { id, number } = await params;
  return { title: (await cardTitle(context, id, Number(number))) ?? undefined };
}

/**
 * One card. Read through the workspace's own context like everything
 * else; a number that is not on this board is not found.
 */
export default async function CardRoute({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const full = await getCardFull(context, id, n);
  if (!full) notFound();
  const [role, aiAvailable] = await Promise.all([
    withOrgContext(context, (tx) => roleOf(tx, context)),
    modelConfigured(context),
  ]);
  return (
    <CardPage
      full={full}
      currentUserId={context.userId}
      canManage={canManage(role)}
      aiAvailable={aiAvailable}
    />
  );
}
