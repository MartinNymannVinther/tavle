"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDaysIso } from "@/core/dates";
import { PLAN_DATE_MAX, PLAN_DATE_MIN } from "@/modules/boards/plan-dates";
import type { Sprint } from "@/core/db/schema";
import { applySprintGoalAction, proposeSprintGoalAction } from "@/modules/ai/actions-assists";
import { createSprintAction, updateSprintAction } from "@/modules/boards/actions-sprints";
import type { Run } from "@/components/board/use-board-actions";

/**
 * A sprint's few words: a name, a goal, two dates. Used both to plan a
 * new one and to change one that has not closed. The dates default to
 * the day after the last sprint ends and the board's usual length, which
 * is what most teams want and nobody wants to type. With a model set up
 * an existing sprint's goal can start as a proposal drafted from its own
 * cards (docs/adr/0026); the person rewrites and saves, and the save is
 * marked as the AI's work.
 */
export function SprintForm({
  boardId,
  sprint,
  nextNumber,
  suggestedStart,
  lengthDays,
  trigger,
  run,
  aiAssist = false,
}: {
  boardId: string;
  sprint?: Sprint;
  nextNumber: number;
  suggestedStart: string;
  lengthDays: number;
  trigger: React.ReactElement;
  run: Run;
  /** A model is set up and the sprint exists: offer the goal drafter. */
  aiAssist?: boolean;
}) {
  const t = useTranslations("backlog.sprintForm");
  const aiErrors = useTranslations("cards.ai.errors");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(sprint?.name ?? t("defaultName", { number: nextNumber }));
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint?.startDate ?? suggestedStart);
  const [endDate, setEndDate] = useState(
    sprint?.endDate ?? addDaysIso(suggestedStart, lengthDays - 1),
  );
  const [aiDraft, setAiDraft] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function suggest() {
    if (!sprint) return;
    setPending(true);
    setFailure(null);
    const result = await proposeSprintGoalAction({ sprintId: sprint.id });
    setPending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setGoal(result.proposal);
    setAiDraft(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      sprint
        ? aiDraft && goal.trim()
          ? applySprintGoalAction({ sprintId: sprint.id, name, goal, startDate, endDate })
          : updateSprintAction({ sprintId: sprint.id, name, goal, startDate, endDate })
        : createSprintAction({ boardId, name, goal, startDate, endDate }),
    );
    setPending(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sprint ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sprint-name">{t("name")}</FieldLabel>
              <Input
                id="sprint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="sprint-goal">{t("goal")}</FieldLabel>
                {aiAssist && sprint && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-meta"
                    disabled={pending}
                    onClick={() => void suggest()}
                  >
                    <Sparkles data-slot="icon" />
                    {t("suggestGoal")}
                  </Button>
                )}
              </div>
              <Textarea
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t("goalPlaceholder")}
              />
              {aiDraft && <p className="text-meta text-2xs">{t("aiDraft")}</p>}
              {failure && <p className="text-destructive text-xs">{aiErrors(failure)}</p>}
            </Field>
            <div className="flex flex-wrap gap-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="sprint-start">{t("start")}</FieldLabel>
                {/* Bounded, because a native date field passes through
                    0002, 0020 and 0202 on the way to 2026 and the service
                    refuses those (src/modules/boards/plan-dates.ts). */}
                <Input
                  id="sprint-start"
                  type="date"
                  min={PLAN_DATE_MIN}
                  max={PLAN_DATE_MAX}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!sprint && e.target.value)
                      setEndDate(addDaysIso(e.target.value, lengthDays - 1));
                  }}
                  required
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="sprint-end">{t("end")}</FieldLabel>
                <Input
                  id="sprint-end"
                  type="date"
                  min={PLAN_DATE_MIN}
                  max={PLAN_DATE_MAX}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim() || !startDate || !endDate}>
              {sprint ? t("save") : t("create")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
