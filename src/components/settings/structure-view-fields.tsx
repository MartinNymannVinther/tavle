"use client";

import { useTranslations } from "next-intl";
import {
  STRUCTURE_LEVELS,
  SWIMLANE_MODES,
  type StructureLevels,
  type SwimlaneMode,
} from "@/core/db/schema";
import type { StructureViewInput } from "@/modules/boards/validation";
import { cn } from "@/lib/utils";

/**
 * The choice of how much structure a board shows: the levels as one
 * radio, the three fields as checkboxes. Shared by the settings page and
 * the new-board dialog, so a board can start small and grow, or the
 * other way round, with the same words in both places. A Kanban board's
 * settings also offer the swimlane grouping here, because it is the same
 * kind of choice: a way of looking, never a change to the data.
 */
export const DEFAULT_VIEW: StructureViewInput = {
  structureLevels: "epic",
  showKind: true,
  showThemes: true,
  showAreas: true,
  swimlaneBy: "none",
};

/** The field each swimlane mode groups by; a hidden field cannot group the board. */
const LANE_FIELD: Partial<Record<SwimlaneMode, keyof StructureViewInput>> = {
  kind: "showKind",
  theme: "showThemes",
  area: "showAreas",
};

const LEVEL_LABEL: Record<StructureLevels, "levelEpic" | "levelFeature" | "levelCard"> = {
  epic: "levelEpic",
  feature: "levelFeature",
  card: "levelCard",
};

export function StructureViewFields({
  value,
  onChange,
  disabled,
  compact,
  withSwimlanes,
}: {
  value: StructureViewInput;
  onChange: (value: StructureViewInput) => void;
  disabled?: boolean;
  /** In a dialog: tighter rows, no hint under the area box. */
  compact?: boolean;
  /** Kanban settings only: offer the swimlane grouping. */
  withSwimlanes?: boolean;
}) {
  const t = useTranslations("boardSettings.structure");
  const fields = [
    ["showKind", t("kind")],
    ["showThemes", t("themes")],
    ["showAreas", t("areas")],
  ] as const;
  return (
    <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-label mb-1.5 text-xs font-medium">{t("levels")}</legend>
        {STRUCTURE_LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="structure-levels"
              value={level}
              checked={value.structureLevels === level}
              disabled={disabled}
              onChange={() => onChange({ ...value, structureLevels: level })}
              className="accent-[var(--primary)]"
            />
            {t(LEVEL_LABEL[level])}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-label mb-1.5 text-xs font-medium">{t("fields")}</legend>
        {fields.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[key]}
              disabled={disabled}
              onChange={(event) => {
                const next = { ...value, [key]: event.target.checked };
                // Hiding the field the lanes group by turns the lanes off
                // with it; the choice would otherwise name something the
                // board no longer shows.
                if (!event.target.checked && LANE_FIELD[value.swimlaneBy] === key) {
                  next.swimlaneBy = "none";
                }
                onChange(next);
              }}
              className="accent-[var(--primary)]"
            />
            {label}
          </label>
        ))}
        {!compact && !value.showAreas && <p className="text-meta text-xs">{t("areasHint")}</p>}
      </fieldset>
      {withSwimlanes && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-label mb-1.5 text-xs font-medium">{t("swimlanes")}</legend>
          {SWIMLANE_MODES.map((mode) => {
            const field = LANE_FIELD[mode];
            const hidden = field ? !value[field] : false;
            return (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="swimlane-by"
                  value={mode}
                  checked={value.swimlaneBy === mode}
                  disabled={disabled || hidden}
                  onChange={() => onChange({ ...value, swimlaneBy: mode })}
                  className="accent-[var(--primary)]"
                />
                <span className={cn(hidden && "text-muted-foreground")}>
                  {t(`swimlane_${mode}`)}
                </span>
              </label>
            );
          })}
          <p className="text-meta text-xs">{t("swimlanesHint")}</p>
        </fieldset>
      )}
    </div>
  );
}
