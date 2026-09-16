"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedChoice } from "@/components/ui/segmented";
import type { Board, EstimateUnit } from "@/core/db/schema";
import { ESTIMATE_UNITS } from "@/core/db/schema";
import {
  changedCount,
  DEFAULT_HOURS_PER_POINT,
  labelOf,
  scaleOf,
  type EstimateChange,
} from "@/modules/boards/estimates";
import { previewEstimateUnitAction, setEstimateUnitAction } from "@/modules/boards/actions-boards";
import { undoEventAction } from "@/modules/boards/actions-undo";
import type { Run } from "@/components/board/use-board-actions";

/**
 * What the team counts in (docs/adr/0030). Points and T-shirt sizes are
 * the same numbers wearing different words, so moving between them says
 * so plainly; hours are another scale, and crossing to them proposes a
 * table — every estimate on the board and what it would become — that a
 * person reads, adjusts and confirms. Nothing is written until then, and
 * one Fortryd in the activity puts it all back.
 */
export function EstimateSettings({
  board,
  canManage,
  lastChange = null,
  run,
}: {
  board: Board;
  canManage: boolean;
  /** The last switch still open to being taken back; board events have no feed of their own. */
  lastChange?: { id: string; payload: Record<string, unknown> } | null;
  run: Run;
}) {
  const t = useTranslations("boardSettings.estimates");
  const current = board.estimateUnit as EstimateUnit;
  const [choice, setChoice] = useState<EstimateUnit>(current);
  const [factor, setFactor] = useState(String(DEFAULT_HOURS_PER_POINT));
  const [table, setTable] = useState<EstimateChange[] | null>(null);
  const [busy, setBusy] = useState(false);

  const hoursPerPoint = Number(factor) || DEFAULT_HOURS_PER_POINT;
  const crossesScales = scaleOf(current) !== scaleOf(choice);
  const pending = choice !== current;

  async function preview(unit: EstimateUnit, hours: number) {
    if (unit === current) {
      setTable(null);
      return;
    }
    setBusy(true);
    const result = await previewEstimateUnitAction({
      boardId: board.id,
      unit,
      hoursPerPoint: hours,
    });
    setBusy(false);
    setTable(result.ok ? result.data.table : null);
  }

  const changed = table ? changedCount(table) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SegmentedChoice<EstimateUnit>
          value={choice}
          onChange={(unit) => {
            if (!canManage) return;
            setChoice(unit);
            void preview(unit, hoursPerPoint);
          }}
          options={ESTIMATE_UNITS.map((unit) => ({ value: unit, label: t(`unit.${unit}`) }))}
          label={t("title")}
          className={canManage ? undefined : "pointer-events-none opacity-60"}
        />
        <p className="text-meta text-2sm">{t(`hint.${choice}`)}</p>

        {pending && crossesScales && (
          <label className="flex flex-wrap items-center gap-2 text-2sm">
            <span>{t("factor")}</span>
            <Input
              type="number"
              min={0.5}
              max={40}
              step={0.5}
              value={factor}
              onChange={(event) => setFactor(event.target.value)}
              onBlur={() => void preview(choice, Number(factor) || DEFAULT_HOURS_PER_POINT)}
              className="h-8 w-20 text-2sm"
              disabled={!canManage}
            />
            <span className="text-meta">{t("factorHint")}</span>
          </label>
        )}

        {pending && table && table.length > 0 && (
          <div className="border-hairline overflow-hidden rounded-lg border">
            <p className="text-meta border-hairline border-b px-3 py-2 text-2sm">
              {changed === 0 ? t("nothingChanges") : t("willChange", { cards: changed })}
            </p>
            <ul className="divide-hairline divide-y">
              {table.map((row) => (
                <li
                  key={row.from}
                  className="flex items-center gap-2 px-3 py-1.5 text-2sm tabular-nums"
                >
                  <span className="w-16">{labelOf(row.from, current)}</span>
                  <ArrowRight className="text-meta size-3.5 shrink-0" aria-hidden />
                  <span className={row.from === row.to ? "text-meta w-16" : "w-16 font-semibold"}>
                    {labelOf(row.to, choice)}
                  </span>
                  <span className="text-meta ml-auto">{t("cards", { count: row.cards })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pending && table && table.length === 0 && (
          <p className="text-meta text-2sm">{t("noEstimates")}</p>
        )}

        {!pending && lastChange && canManage && (
          // A board change has no activity feed to carry its Fortryd, so
          // the surface that made it offers it. Without this the promise
          // that the switch can be undone would not be true anywhere.
          <p className="text-meta flex flex-wrap items-center gap-2 text-2sm">
            <span>
              {t("lastChange", {
                unit: t(`unit.${String(lastChange.payload.unit ?? "points")}`),
                cards: Number(lastChange.payload.cards ?? 0),
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void run(() => undoEventAction({ eventId: lastChange.id }))}
            >
              {t("undo")}
            </Button>
          </p>
        )}
        {canManage && pending && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                void run(() =>
                  setEstimateUnitAction({ boardId: board.id, unit: choice, hoursPerPoint }),
                ).then((ok) => {
                  if (ok) setTable(null);
                });
              }}
            >
              {t("apply", { unit: t(`unit.${choice}`) })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setChoice(current);
                setTable(null);
              }}
            >
              {t("cancel")}
            </Button>
            <span className="text-meta text-2sm">{t("undoable")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
