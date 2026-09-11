"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Result } from "@/core/result";

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
) => Promise<boolean>;

export function useBoardActions(): { run: Run; pending: boolean } {
  const router = useRouter();
  const t = useTranslations("boards.errors");
  const rules = useTranslations("boards.rules");
  const [pending, startTransition] = useTransition();

  const run: Run = async (action, onDone) => {
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
    if (result.error === "conflict") {
      toast.error(t("conflict"));
      startTransition(() => router.refresh());
      return false;
    }
    // A refused rule of the backlog structure names itself, so the toast can
    // say which field rather than "something".
    if (result.error === "invalid" && result.detail) {
      toast.error(rules.has(result.detail) ? rules(result.detail) : t("invalid"));
      return false;
    }
    toast.error(t(result.error));
    return false;
  };

  return { run, pending };
}
