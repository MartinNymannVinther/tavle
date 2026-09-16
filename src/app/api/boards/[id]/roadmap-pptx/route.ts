import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgContext } from "@/core/auth/guard";
import { routing, type Locale } from "@/i18n/routing";
import { buildRoadmapPptx } from "@/modules/export/roadmap-pptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The roadmap as one downloadable slide (docs/adr/0028). Same door as
 * every page: the caller's workspace first, and a board id from another
 * workspace is simply not found.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  // A route has no locale segment to read, so the page says which language
  // it is asking in — and anything else falls back to the default rather
  // than being trusted.
  const asked = new URL(request.url).searchParams.get("locale");
  const locale = (routing.locales as readonly string[]).includes(asked ?? "")
    ? (asked as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "roadmap" });
  const buffer = await buildRoadmapPptx(ctx, id, { unplanned: t("pptUnplanned") });
  if (!buffer) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="roadmap.pptx"',
    },
  });
}
