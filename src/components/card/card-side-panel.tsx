"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PropertyGroup, PropertyRow } from "@/components/ui/property-row";
import { Textarea } from "@/components/ui/textarea";
import type { Area, Column, EstimateUnit, Priority, Sprint, Theme } from "@/core/db/schema";
import { PRIORITIES } from "@/core/db/schema";
import type { CardDetail, ItemView, PersonRef } from "@/modules/boards/types";
import { moveCardAction, updateCardAction } from "@/modules/boards/actions-cards";
import { setCardsSprintAction } from "@/modules/boards/actions-sprints";
import type { Run } from "@/components/board/use-board-actions";
import type { StructureView } from "@/modules/boards/structure/view";
import { cn } from "@/lib/utils";
import { TSHIRT } from "@/modules/boards/estimates";
import { PlacementFields } from "./placement-fields";

/**
 * The card's facts as a column of property rows, each a control that
 * saves on change, in three groups: where it is and whose it is, how it
 * is planned, and where it belongs in the structure. No save button,
 * because every field is one decision and nobody wants to remember to
 * press a button after it.
 */
export function CardSidePanel({
  card,
  boardKey,
  columns,
  themes,
  areas,
  features,
  sprints,
  people,
  scrum,
  view,
  unit,
  run,
}: {
  card: CardDetail;
  boardKey: string;
  columns: Column[];
  themes: Theme[];
  areas: Area[];
  features: ItemView[];
  sprints: Sprint[];
  people: PersonRef[];
  scrum: boolean;
  view: StructureView;
  /** What the board counts in, so the field asks for the right thing (docs/adr/0030). */
  unit: EstimateUnit;
  run: Run;
}) {
  const t = useTranslations("cards.fields");
  const priorities = useTranslations("boards.priority");
  const [reason, setReason] = useState(card.blockedReason);
  const update = (fields: Record<string, unknown>) =>
    run(() => updateCardAction({ cardId: card.id, ...fields }));
  const control = "h-8 text-2sm";

  return (
    <>
      <PropertyGroup>
        <PropertyRow
          label={t("column")}
          htmlFor="card-column"
          hint={scrum && !card.sprintId ? t("inBacklog") : undefined}
        >
          <NativeSelect
            id="card-column"
            variant="xs"
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
        </PropertyRow>
        {scrum && (
          <PropertyRow label={t("sprint")} htmlFor="card-sprint">
            <NativeSelect
              id="card-sprint"
              variant="xs"
              value={card.sprintId ?? ""}
              onChange={(event) =>
                void run(() =>
                  setCardsSprintAction({
                    cardIds: [card.id],
                    sprintId: event.target.value || null,
                  }),
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
          </PropertyRow>
        )}
        <PropertyRow label={t("assignee")} htmlFor="card-assignee">
          <NativeSelect
            id="card-assignee"
            variant="xs"
            value={card.assigneePersonId ?? ""}
            onChange={(event) => void update({ assigneePersonId: event.target.value || null })}
          >
            <option value="">{t("nobody")}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        </PropertyRow>
        <PropertyRow label={t("dueDate")} htmlFor="card-due">
          <Input
            id="card-due"
            type="date"
            defaultValue={card.dueDate ?? ""}
            onChange={(event) => {
              const value = event.target.value || null;
              if (value !== card.dueDate) void update({ dueDate: value });
            }}
            className={cn(control, "w-full rounded-sm")}
          />
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup>
        <PropertyRow label={t(`estimateLabel.${unit}`)} htmlFor="card-estimate">
          {unit === "tshirt" ? (
            // Sizes are a closed list, so the size is picked, never typed.
            <NativeSelect
              id="card-estimate"
              variant="xs"
              value={card.estimate === null ? "" : String(card.estimate)}
              onChange={(event) => {
                const next = event.target.value === "" ? null : Number(event.target.value);
                if (next !== card.estimate) void update({ estimate: next });
              }}
            >
              <option value="">{t("noEstimate")}</option>
              {TSHIRT.map((size) => (
                <option key={size.size} value={size.weight}>
                  {size.size}
                </option>
              ))}
            </NativeSelect>
          ) : (
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
              className={cn(control, "w-24 rounded-sm")}
            />
          )}
        </PropertyRow>
        <PropertyRow label={t("priority")} htmlFor="card-priority">
          <NativeSelect
            id="card-priority"
            variant="xs"
            value={card.priority}
            onChange={(event) => void update({ priority: event.target.value as Priority })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorities(priority)}
              </option>
            ))}
          </NativeSelect>
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup>
        <PlacementFields
          card={card}
          boardKey={boardKey}
          themes={themes}
          areas={areas}
          features={features}
          view={view}
          run={run}
        />
      </PropertyGroup>

      <PropertyGroup>
        <PropertyRow label={t("blocked")} htmlFor="card-blocked">
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              id="card-blocked"
              type="checkbox"
              checked={card.blocked}
              onChange={(event) =>
                void update({ blocked: event.target.checked, blockedReason: reason })
              }
              className="accent-[var(--destructive)]"
            />
            <span className={cn("text-2sm", card.blocked && "text-destructive font-medium")}>
              {card.blocked ? t("blockedYes") : t("blockedNo")}
            </span>
          </label>
        </PropertyRow>
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
            className="mt-1 text-2sm"
          />
        )}
      </PropertyGroup>
    </>
  );
}
