import { z } from "zod";
import { proposeCloseDecisions } from "@/modules/ai/advice";
import { aiRead } from "@/modules/ai/read-route";
import { id } from "@/modules/boards/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A starting position for the close conversation (docs/adr/0026). A read:
 * it pre-sets the dialog's selects, and the close itself still goes
 * through the ordinary action, which re-validates every id and rule.
 */
const Body = z.object({ itemId: id });

export function POST(request: Request) {
  return aiRead(request, Body, (ctx, input, locale) =>
    proposeCloseDecisions(ctx, input.itemId, locale),
  );
}
