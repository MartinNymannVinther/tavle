import { z } from "zod";
import { proposeQuickAssist } from "@/modules/ai/assists";
import { aiRead } from "@/modules/ai/read-route";
import { id, shortText } from "@/modules/boards/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a card being typed belongs, and whether it already exists
 * (docs/adr/0025). A read: it moves a select and shows a line, and the
 * card is still created by the person through the ordinary action.
 */
const Body = z.object({ boardId: id, title: shortText(200).min(8) });

export function POST(request: Request) {
  return aiRead(
    request,
    Body,
    (ctx, input, locale) => proposeQuickAssist(ctx, input.boardId, input.title, locale),
    { requireModel: true },
  );
}
