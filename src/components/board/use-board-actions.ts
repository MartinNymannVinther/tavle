"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionError, Result } from "@/core/result";

/**
 * Every write a board page makes, in one place. Each call reports the
 * outcome in words the person can act on: a conflict means somebody else
 * changed the row, which is not the same as an error, and the page
 * reloads so they see what it actually says now.
 *
 * It answers with whether the write landed, so a form can clear itself on
 * success and keep what was typed when it did not.
 */
export type Run = <T>(
  action: () => Promise<Result<T>>,
  onDone?: (data: T) => void,
  /** For a form that wants to mark the field the refusal names. */
  onError?: (error: ActionError, detail?: string) => void,
) => Promise<boolean>;

export function useBoardActions(): { run: Run; pending: boolean } {
  const router = useRouter();
  const t = useTranslations("boards.errors");
  const rules = useTranslations("boards.rules");
  const [pending, startTransition] = useTransition();

  const run: Run = async (action, onDone, onError) => {
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action();
    } catch (error) {
      console.error("board action failed", error);
      toast.error(t("generic"));
      return false;
    }
    if (result.ok) {
      onDone?.(result.data);
      startTransition(() => router.refresh());
      return true;
    }
    onError?.(result.error, result.detail);
    if (result.error === "conflict") {
      toast.error(t("conflict"));
      startTransition(() => router.refresh());
      return false;
    }
    // A refused rule of the backlog structure names itself, and so does a
    // name or a key already in use, so the toast can say which field
    // rather than "something".
    if (result.error === "invalid" && result.detail) {
      const named = result.detail;
      toast.error(t.has(named) ? t(named) : rules.has(named) ? rules(named) : t("invalid"));
      return false;
    }
    toast.error(t(result.error));
    return false;
  };

  return { run, pending };
}
