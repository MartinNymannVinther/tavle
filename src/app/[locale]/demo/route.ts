import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { reserveDemoForAddress } from "@/modules/demo/quota";
import {
  createDemoWorkspace,
  demoCookieSecure,
  demoEnabled,
  demoLandingUrl,
  DEMO_TTL_HOURS,
} from "@/modules/demo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A refusal the browser can read. Without a content type a body is not
 * rendered but saved, and the visitor gets an empty file named after the
 * path instead of the sentence explaining why the demo did not open.
 *
 * The sentence comes from the catalogue in the locale the visitor asked
 * in: someone who is refused is owed the reason in their own language as
 * much as someone who is let in, and more so, because it is the only
 * thing they get.
 */
function refusal(message: string, status: number, headers: HeadersInit = {}) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

/**
 * The front door for someone who wants to try Tavle without asking for an
 * account. It builds a workspace, seeds two boards in the middle of their
 * work, signs the visitor in and sends them to the first.
 *
 * A GET that creates something is unusual, and deliberate: the point is a
 * link somebody can put on a website. What it creates is throwaway, so
 * the usual reason not to — a crawler triggering it — costs a row that
 * expires within the day, and the two bounds in `modules/demo/quota`
 * keep that bounded: what one address may ask for, and how many demos
 * the installation will hold at once.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  if (!demoEnabled()) return refusal("Not found", 404);

  const { locale } = await params;
  const language = locale === "en" ? "en" : "da";
  const t = await getTranslations({ locale: language, namespace: "demo" });

  // The address is asked before anything is built, so a caller over its
  // line costs a lookup in memory rather than a workspace.
  const limit = reserveDemoForAddress(request.headers);
  if (!limit.allowed)
    return refusal(t("refusedAddress"), 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });

  const demo = await createDemoWorkspace(language);
  if (!demo.ok) {
    // Full is a 429 and not a 503: it is a limit that has been reached
    // and the installation is perfectly well. No Retry-After, because the
    // honest answer is "when the oldest demo expires", which is at most a
    // day away and may be a minute — and a header that names a number
    // nobody computed is worse than no header.
    if (demo.reason === "full") return refusal(t("refusedFull", { hours: DEMO_TTL_HOURS }), 429);
    return refusal(t("refusedFailed"), 503);
  }

  // Both the destination and the cookie's Secure flag come from the
  // installation's public origin, not from the request: behind the proxy
  // the request only knows the container's own address.
  const response = NextResponse.redirect(demoLandingUrl(language, demo.boardId), {
    status: 303,
  });
  // The sign-up call answered with the session cookie; hand it on.
  for (const cookie of demo.headers.get("cookie")?.split("; ") ?? []) {
    const [name, ...rest] = cookie.split("=");
    if (name && rest.length)
      response.cookies.set(name, rest.join("="), {
        httpOnly: true,
        sameSite: "lax",
        secure: demoCookieSecure(),
        path: "/",
      });
  }
  return response;
}
