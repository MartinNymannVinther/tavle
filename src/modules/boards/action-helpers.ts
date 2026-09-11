import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { fail, ok, type ActionError, type Result } from "@/core/result";
import { Conflict } from "./lanes";
import { canManage, roleOf } from "./members";
import { RuleViolation } from "./structure/rules";
import { NameTaken } from "./structure/write-lists";
import { KeyTaken } from "./write-boards";
import { SprintStateError } from "./write-sprints";

/**
 * The shape every server action in the product has: resolve the caller's
 * workspace, validate the input, run one transaction, refresh the page.
 * Nothing else. An action that reaches past this helper is a bug — the
 * whole point is that authorization cannot be forgotten in one place.
 *
 * Ids are never trusted from the client. The services check that every id
 * belongs to the board, and RLS checks that the board belongs to the
 * workspace, so a stolen id fails twice.
 */

/** Refreshes the pages a board change can be visible on. */
export function revalidateBoard(boardId?: string | null) {
  revalidatePath("/boards");
  revalidatePath("/my");
  if (boardId) revalidatePath(`/boards/${boardId}`, "layout");
}

type Options = {
  /** Owners and admins only. */
  manage?: boolean;
};

export class NotFound extends Error {
  constructor() {
    super("notFound");
  }
}

export class Forbidden extends Error {
  constructor() {
    super("forbidden");
  }
}

/** Answers the row, or turns "not in this workspace" into a not-found error. */
export const found = <T>(row: T | null | undefined): T => {
  if (row === null || row === undefined) throw new NotFound();
  return row;
};

/**
 * Runs `fn` with a validated payload inside the caller's workspace. The
 * return value is the action's data; the board whose pages refresh is
 * whatever `fn` names through `touch`, or the payload's own `boardId`.
 */
export async function action<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  fn: (
    tx: AppTransaction,
    ctx: OrgContext,
    input: z.infer<S>,
    touch: (boardId: string | null | undefined) => void,
  ) => Promise<T>,
  options: Options = {},
): Promise<Result<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  let touched: string | null | undefined;
  try {
    const data = await withOrgContext(ctx, async (tx) => {
      if (options.manage && !canManage(await roleOf(tx, ctx))) throw new Forbidden();
      return fn(tx, ctx, parsed.data, (boardId) => {
        touched = boardId;
      });
    });
    const fromPayload = (parsed.data as { boardId?: unknown }).boardId;
    revalidateBoard(touched ?? (typeof fromPayload === "string" ? fromPayload : null));
    return ok(data);
  } catch (error) {
    if (error instanceof RuleViolation) return fail("invalid", error.code);
    return fail(classify(error));
  }
}

/** An action that needs the workspace but no payload. */
export async function withWorkspace<T>(fn: (ctx: OrgContext) => Promise<T>): Promise<Result<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  try {
    return ok(await fn(ctx));
  } catch (error) {
    return fail(classify(error));
  }
}

function classify(error: unknown): ActionError {
  if (error instanceof Conflict || error instanceof KeyTaken || error instanceof NameTaken) {
    return "conflict";
  }
  if (error instanceof SprintStateError) return "conflict";
  if (error instanceof NotFound) return "notFound";
  if (error instanceof Forbidden) return "forbidden";
  if (error instanceof Error && error.message === "notFound") return "notFound";
  if (error instanceof Error && error.message === "forbidden") return "forbidden";
  if (error instanceof Error && error.message === "invalid") return "invalid";
  // Details stay in the server log; the client gets a word it can render.
  console.error("action failed", error);
  return "generic";
}
