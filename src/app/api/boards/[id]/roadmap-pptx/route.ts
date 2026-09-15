import { NextResponse } from "next/server";
import { requireOrgContext } from "@/core/auth/guard";
import { buildRoadmapPptx } from "@/modules/export/roadmap-pptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The roadmap as one downloadable slide (docs/adr/0028). Same door as
 * every page: the caller's workspace first, and a board id from another
 * workspace is simply not found.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const buffer = await buildRoadmapPptx(ctx, id);
  if (!buffer) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="roadmap.pptx"',
    },
  });
}
