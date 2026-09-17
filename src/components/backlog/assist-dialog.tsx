"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/components/board/use-board-actions";
import { Link } from "@/i18n/navigation";
import {
  applyBacklogAssistAction,
  proposeBacklogAssistAction,
} from "@/modules/ai/actions-backlog-assist";
import { MAX_INSTRUCTION_CHARS } from "@/modules/ai/wire";
import {
  AssistReview,
  keepChecked,
  keptCount,
  toEditable,
  type EditableAssist,
} from "./assist-review";

/**
 * The assistant on a backlog that already exists (docs/adr/0037): the
 * person writes the task in their own words, the model answers with the
 * four things it may propose, and nothing is saved until the person has
 * pruned it and said yes. It stands in the same slot as the starting
 * point, under the same Sparkles — the board decides which of the two
 * is the honest offer, never this component.
 */
export function AssistDialog({
  boardId,
  run,
  available = true,
}: {
  boardId: string;
  run: Run;
  /** Without a model the button says so up front, before anyone writes a task. */
  available?: boolean;
}) {
  const t = useTranslations("aiAssist");
  const ai = useTranslations("cards.ai");
  const errors = useTranslations("cards.ai.errors");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [engine, setEngine] = useState("");
  const [tree, setTree] = useState<EditableAssist | null>(null);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await proposeBacklogAssistAction({ boardId, instruction });
    setPending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setEngine(result.engine);
    setTree(toEditable(result.proposal));
  }

  async function apply() {
    if (!tree) return;
    const kept = keepChecked(tree);
    if (keptCount(kept) === 0) return;
    setPending(true);
    const ok = await run(() => applyBacklogAssistAction({ boardId, engine, ...kept }));
    setPending(false);
    if (ok) {
      setOpen(false);
      setTree(null);
      setInstruction("");
    }
  }

  if (!available) {
    return (
      <p className="text-meta flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2sm">
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
        <span className="font-medium">{t("cta")}:</span>
        <span>{ai("noModelShort")}</span>
        <Link href="/settings/ai" className="text-primary underline-offset-4 hover:underline">
          {ai("noModelLink")}
        </Link>
      </p>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFailure(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Sparkles data-slot="icon" />
            {t("cta")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{tree ? t("reviewSubtitle") : t("subtitle")}</DialogDescription>
        </DialogHeader>
        {tree ? (
          <div className="flex flex-col gap-4">
            <AssistReview tree={tree} onChange={setTree} />
            {/* What the AI writes is marked in the activity feed and can be pruned here first. */}
            <p className="text-meta text-xs">{t("marked", { engine })}</p>
            <DialogFooter>
              {/* Untick everything and the button has nothing to do; saying
                  so beforehand is better than a press that answers with
                  silence. */}
              <Button
                type="button"
                onClick={() => void apply()}
                disabled={pending || keptCount(keepChecked(tree)) === 0}
              >
                {t("apply")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setTree(null)}>
                {t("back")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={ask} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="assist-instruction">{t("instruction")}</FieldLabel>
              <Textarea
                id="assist-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                required
                minLength={3}
                maxLength={MAX_INSTRUCTION_CHARS}
                rows={4}
                placeholder={t("instructionPlaceholder")}
              />
              <FieldDescription>{t("instructionHint")}</FieldDescription>
            </Field>
            {failure && (
              <p role="alert" className="text-destructive text-sm">
                {/* The model answered, but nothing in it survived the sanitizer. */}
                {failure === "notFound"
                  ? t("nothing")
                  : ["noModel", "rateLimited", "unreachable", "badAnswer"].includes(failure)
                    ? errors(failure)
                    : errors("generic")}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending || instruction.trim().length < 3}>
                {pending ? t("thinking") : t("propose")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
