/**
 * What a proposal answers with, in one place because both doors use it:
 * the server actions that propose-and-apply, and the read-only routes the
 * quiet assists fetch (docs/adr/0034). Plain types and nothing else, so a
 * client component can name them without pulling a server module into its
 * bundle.
 */

/** The word the interface shows for why the model did not answer. */
export type AiFailure = "noModel" | "rateLimited" | "unreachable" | "badAnswer" | "generic";

export type ProposalResult<T> =
  | { ok: true; proposal: T; engine: string }
  | { ok: false; error: AiFailure | "unauthorized" | "invalid" | "notFound" };
