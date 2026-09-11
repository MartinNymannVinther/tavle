"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { LabelChip } from "@/components/board/bits";
import type { Column, Label, Priority, Sprint } from "@/core/db/schema";
import { PRIORITIES } from "@/core/db/schema";
import type { CardView, Member } from "@/modules/boards/types";
import {
  moveCardAction,
  setCardLabelsAction,
  updateCardAction,
} from "@/modules/boards/actions-cards";
import { setCardsSprintAction } from "@/modules/boards/actions-sprints";
import type { Run } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";

/**
 * The card's facts, each a control that saves on change: where it is,
 * whose it is, how big, how urgent, when it is due, what it is tagged
 * with, and whether it is stuck. No save button, because every field is
 * one decision and nobody wants to remember to press a button after it.
 */
export function CardSidePanel({
  card,
  columns,
  labels,
  sprints,
  members,
  scrum,
  run,
}: {
  card: CardView;
  columns: Column[];
  labels: Label[];
  sprints: Sprint[];
  members: Member[];
  scrum: boolean;
  run: Run;
}) {
  const t = useTranslations("cards.fields");
  const priorities = useTranslations("boards.priority");
  const [reason, setReason] = useState(card.blockedReason);
  const update = (fields: Record<string, unknown>) =>
    run(() => updateCardAction({ cardId: card.id, ...fields }));

  function toggleLabel(labelId: string) {
    const next = card.labelIds.includes(labelId)
      ? card.labelIds.filter((id) => id !== labelId)
      : [...card.labelIds, labelId];
    void run(() => setCardLabelsAction({ cardId: card.id, labelIds: next }));
  }

  const rowClass = "flex flex-col gap-1.5";
  const labelClass = "text-label text-[0.72rem] font-medium";

  return (
    <div className="flex flex-col gap-4">
      <div className={rowClass}>
        <label htmlFor="card-column" className={labelClass}>
          {t("column")}
        </label>
        <NativeSelect
          id="card-column"
          variant="sm"
          value={card.columnId}
          disabled={scrum && !card.sprintId}
          onChange={(event) =>
            void run(() => moveCardAction({ cardId: card.id, columnId: event.target.value }))
          }
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.name}
            </option>
          ))}
        </NativeSelect>
        {scrum && !card.sprintId && <p className="text-meta text-[0.72rem]">{t("inBacklog")}</p>}
      </div>

      {scrum && (
        <div className={rowClass}>
          <label htmlFor="card-sprint" className={labelClass}>
            {t("sprint")}
          </label>
          <NativeSelect
            id="card-sprint"
            variant="sm"
            value={card.sprintId ?? ""}
            onChange={(event) =>
              void run(() =>
                setCardsSprintAction({ cardIds: [card.id], sprintId: event.target.value || null }),
              )
            }
          >
            <option value="">{t("backlog")}</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
                {sprint.state === "active" ? ` · ${t("active")}` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className={rowClass}>
        <label htmlFor="card-assignee" className={labelClass}>
          {t("assignee")}
        </label>
        <NativeSelect
          id="card-assignee"
          variant="sm"
          value={card.assigneeUserId ?? ""}
          onChange={(event) => void update({ assigneeUserId: event.target.value || null })}
        >
          <option value="">{t("nobody")}</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={rowClass}>
          <label htmlFor="card-estimate" className={labelClass}>
            {t("estimate")}
          </label>
          <Input
            id="card-estimate"
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            defaultValue={card.estimate ?? ""}
            onBlur={(event) => {
              const value = event.target.value.trim();
              const next =
                value === "" ? null : Math.max(0, Math.min(1000, Math.round(Number(value))));
              if (next !== card.estimate) void update({ estimate: next });
            }}
            className="h-9 text-[0.8125rem]"
          />
        </div>
        <div className={rowClass}>
          <label htmlFor="card-priority" className={labelClass}>
            {t("priority")}
          </label>
          <NativeSelect
            id="card-priority"
            variant="sm"
            value={card.priority}
            onChange={(event) => void update({ priority: event.target.value as Priority })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorities(priority)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className={rowClass}>
        <label htmlFor="card-due" className={labelClass}>
          {t("dueDate")}
        </label>
        <Input
          id="card-due"
          type="date"
          defaultValue={card.dueDate ?? ""}
          onChange={(event) => {
            const value = event.target.value || null;
            if (value !== card.dueDate) void update({ dueDate: value });
          }}
          className="h-9 w-full text-[0.8125rem]"
        />
      </div>

      {labels.length > 0 && (
        <div className={rowClass}>
          <span className={labelClass}>{t("labels")}</span>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => {
              const on = card.labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    "focus-visible:ring-ring rounded-full ring-offset-1 transition focus-visible:ring-2 focus-visible:outline-none",
                    !on && "opacity-45 hover:opacity-80",
                  )}
                >
                  <LabelChip label={label} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={rowClass}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={card.blocked}
            onChange={(event) =>
              void update({ blocked: event.target.checked, blockedReason: reason })
            }
            className="accent-[var(--destructive)]"
          />
          <span className={cn("font-medium", card.blocked && "text-destructive")}>
            {t("blocked")}
          </span>
        </label>
        {card.blocked && (
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => {
              if (reason !== card.blockedReason)
                void update({ blocked: true, blockedReason: reason });
            }}
            rows={2}
            maxLength={300}
            placeholder={t("blockedReason")}
            aria-label={t("blockedReason")}
            className="text-[0.8125rem]"
          />
        )}
      </div>
    </div>
  );
}
