"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPlanDate, todayInCopenhagen } from "@/core/dates";
import type { Sprint } from "@/core/db/schema";
import type { Run } from "@/components/board/use-board-actions";
import { startSprintAction, updateSprintAction } from "@/modules/boards/actions-sprints";

/**
 * The button that begins a sprint. When the planned first day is not
 * today it asks first: keep the plan's dates, or slide the whole span
 * so the sprint starts today at the same length. Either answer starts
 * the sprint; only the person picks which calendar it lives on.
 */
export function StartSprint({
  sprint,
  canStart,
  run,
}: {
  sprint: Sprint;
  canStart: boolean;
  run: Run;
}) {
  const t = useTranslations("backlog.sprint");
  const locale = useLocale();
  const [asking, setAsking] = useState(false);
  const today = todayInCopenhagen();
  const start = () => run(() => startSprintAction({ sprintId: sprint.id }));
  const slideAndStart = async () => {
    const length =
      Date.parse(`${sprint.endDate}T00:00Z`) - Date.parse(`${sprint.startDate}T00:00Z`);
    const endDate = new Date(Date.parse(`${today}T00:00Z`) + length).toISOString().slice(0, 10);
    const moved = await run(() =>
      updateSprintAction({
        sprintId: sprint.id,
        name: sprint.name,
        goal: sprint.goal ?? "",
        startDate: today,
        endDate,
      }),
    );
    if (moved) await start();
    setAsking(false);
  };
  return (
    <>
      <Button
        type="button"
        size="xs"
        disabled={!canStart}
        title={canStart ? undefined : t("anotherActive")}
        onClick={() => (sprint.startDate === today ? void start() : setAsking(true))}
      >
        {t("start")}
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("startAskTitle", { name: sprint.name })}</DialogTitle>
            <DialogDescription>
              {t("startAskBody", {
                planned: formatPlanDate(sprint.startDate, locale),
                today: formatPlanDate(today, locale),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAsking(false);
                void start();
              }}
            >
              {t("startKeep")}
            </Button>
            <Button type="button" onClick={() => void slideAndStart()}>
              {t("startToday")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
