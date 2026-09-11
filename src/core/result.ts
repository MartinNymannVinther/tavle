/**
 * Every mutation answers with one of these; the UI never sees a stack.
 * The error is a word the interface can render in the reader's language,
 * and the details stay in the server log.
 */
export type ActionError =
  "unauthorized" | "forbidden" | "invalid" | "notFound" | "conflict" | "generic";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = undefined>(error: ActionError): Result<T> => ({ ok: false, error });
