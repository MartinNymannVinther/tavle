"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { diffDays, formatDateDa } from "@/core/dates";
import type { Sprint } from "@/core/db/schema";
import { closeSprintAction } from "@/modules/boards/actions-sprints";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Run } from "./use-board-actions";

/**
 * The strip above a Scrum board: which sprint this is, what it is for,
 * how far it has come in days and points, and the one thing that ends
 * it. Closing asks where the unfinished cards go, because that is the
 * decision, not the click.
 */
export function SprintHeader({
  sprint,
  planned,
  boardId,
  today,
  donePoints,
  totalPoints,
  doneCards,
  totalCards,
  run,
}: {
  sprint: Sprint;
  planned: Sprint[];
  boardId: string;
  today: string;
  donePoints: number;
  totalPoints: number;
  doneCards: number;
  totalCards: number;
  run: Run;
}) {
  const t = useTranslations("boards.sprint");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [pending, setPending] = useState(false);
  const daysLeft = diffDays(today, sprint.endDate);
  const share =
    totalPoints > 0
      ? Math.round((donePoints / totalPoints) * 100)
      : totalCards > 0
        ? Math.round((doneCards / totalCards) * 100)
        : 0;

  async function close() {
    setPending(true);
    await run(() => closeSprintAction({ sprintId: sprint.id, moveUnfinishedTo: target || null }));
    setPending(false);
    setOpen(false);
  }

  return (
    <div className="bg-card border-border flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-4 py-3 shadow-[var(--surface-shadow)]">
      <div className="min-w-0 flex-1">
        <p className="text-chart-2 text-[0.72rem] font-medium">
          {t("kicker", {
            start: formatDateDa(sprint.startDate),
            end: formatDateDa(sprint.endDate),
          })}
        </p>
        <p className="truncate text-base font-semibold">
          {sprint.name}
          {sprint.goal ? <span className="text-meta font-normal"> · {sprint.goal}</span> : null}
        </p>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <div>
          <p className="text-label text-[0.69rem]">{t("daysLeft")}</p>
          <p className={cn("font-semibold tabular-nums", daysLeft < 0 && "text-destructive")}>
            {daysLeft < 0 ? t("overdue", { days: -daysLeft }) : daysLeft}
          </p>
        </div>
        <div>
          <p className="text-label text-[0.69rem]">{t("progress")}</p>
          <p className="font-semibold tabular-nums">
            {totalPoints > 0
              ? `${donePoints}/${totalPoints} ${t("points")}`
              : `${doneCards}/${totalCards}`}
            <span className="text-meta ml-1.5 font-normal">{share}%</span>
          </p>
        </div>
        <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-primary h-full rounded-full" style={{ width: `${share}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/boards/${boardId}/backlog`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("toBacklog")}
        </Link>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            {t("close")}
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("closeTitle", { name: sprint.name })}</DialogTitle>
              <DialogDescription>
                {t("closeBody", {
                  done: doneCards,
                  open: totalCards - doneCards,
                  points: donePoints,
                })}
              </DialogDescription>
            </DialogHeader>
            {totalCards - doneCards > 0 && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("unfinishedGo")}</span>
                <NativeSelect value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="">{t("toBacklogOption")}</option>
                  {planned.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            <DialogFooter>
              <Button type="button" onClick={close} disabled={pending}>
                {t("closeConfirm")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
