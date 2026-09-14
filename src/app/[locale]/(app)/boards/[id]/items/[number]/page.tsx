import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ItemPage } from "@/components/item/item-page";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext } from "@/core/db/tenant";
import { canManage, roleOf } from "@/modules/boards/members";
import { getItemFull } from "@/modules/boards/structure/read";
import { itemTitle } from "@/modules/boards/read-titles";

type Params = { params: Promise<{ id: string; number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const context = await requireOrgContext();
  if (!context) return {};
  const { id, number } = await params;
  return { title: (await itemTitle(context, id, Number(number))) ?? undefined };
}

/** One epic or feature, by the board's number; a card's number is not found here. */
export default async function ItemRoute({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const full = await getItemFull(context, id, n);
  if (!full) notFound();
  const role = await withOrgContext(context, (tx) => roleOf(tx, context));
  return <ItemPage full={full} canManage={canManage(role)} />;
}
