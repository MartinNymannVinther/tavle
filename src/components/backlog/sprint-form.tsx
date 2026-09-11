"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import type { Sprint } from "@/core/db/schema";
import { createSprintAction, updateSprintAction } from "@/modules/boards/actions-sprints";
import type { Run } from "@/components/board/use-board-actions";

/**
 * A sprint's few words: a name, a goal, two dates. Used both to plan a
 * new one and to change one that has not closed. The dates default to
 * the day after the last sprint ends and the board's usual length, which
 * is what most teams want and nobody wants to type.
 */
export function SprintForm({
  boardId,
  sprint,
  nextNumber,
  suggestedStart,
  lengthDays,
  trigger,
  run,
}: {
  boardId: string;
  sprint?: Sprint;
  nextNumber: number;
  suggestedStart: string;
  lengthDays: number;
  trigger: React.ReactElement;
  run: Run;
}) {
  const t = useTranslations("backlog.sprintForm");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(sprint?.name ?? t("defaultName", { number: nextNumber }));
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint?.startDate ?? suggestedStart);
  const [endDate, setEndDate] = useState(
    sprint?.endDate ?? addDaysIso(suggestedStart, lengthDays - 1),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      sprint
        ? updateSprintAction({ sprintId: sprint.id, name, goal, startDate, endDate })
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
              <FieldLabel htmlFor="sprint-goal">{t("goal")}</FieldLabel>
              <Textarea
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t("goalPlaceholder")}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="sprint-start">{t("start")}</FieldLabel>
                <Input
                  id="sprint-start"
                  type="date"
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
