import type { BacklogItem, Kind } from "@/core/db/schema";
import type { AppTransaction } from "@/core/db/tenant";
import { themeIdsOf } from "./items";

/**
 * What a child takes from its parent. Theme and area are inherited when
 * an item is created under a parent and again when it is moved to one,
 * and can be changed on the item afterwards; the kind is inherited at
 * creation only, because an enabler story under a business feature is
 * ordinary and a move should not flip it.
 */
export type Inherited = { areaId: string | null; themeIds: string[]; kind: Kind };

export async function inheritedFrom(tx: AppTransaction, parent: BacklogItem): Promise<Inherited> {
  return {
    areaId: parent.areaId,
    themeIds: await themeIdsOf(tx, parent.id),
    kind: parent.kind as Kind,
  };
}

/**
 * Resolves what a new child gets: what the caller said where they said
 * something, the parent's where they did not.
 */
export function resolveNew(
  input: { areaId?: string | null; themeIds?: string[]; kind?: Kind },
  parent: Inherited | null,
): Inherited {
  return {
    areaId: input.areaId !== undefined ? input.areaId : (parent?.areaId ?? null),
    themeIds: input.themeIds ?? parent?.themeIds ?? [],
    kind: input.kind ?? parent?.kind ?? "business",
  };
}
