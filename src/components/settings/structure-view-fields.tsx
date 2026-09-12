"use client";

import { useTranslations } from "next-intl";
import { STRUCTURE_LEVELS, type StructureLevels } from "@/core/db/schema";
import type { StructureViewInput } from "@/modules/boards/validation";
import { cn } from "@/lib/utils";

/**
 * The choice of how much structure a board shows: the levels as one
 * radio, the three fields as checkboxes. Shared by the settings page and
 * the new-board dialog, so a board can start small and grow, or the
 * other way round, with the same words in both places.
 */
export const DEFAULT_VIEW: StructureViewInput = {
  structureLevels: "epic",
  showKind: true,
  showThemes: true,
  showAreas: true,
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
}: {
  value: StructureViewInput;
  onChange: (value: StructureViewInput) => void;
  disabled?: boolean;
  /** In a dialog: tighter rows, no hint under the area box. */
  compact?: boolean;
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
        <legend className="text-label mb-1.5 text-[0.72rem] font-medium">{t("levels")}</legend>
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
        <legend className="text-label mb-1.5 text-[0.72rem] font-medium">{t("fields")}</legend>
        {fields.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[key]}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
              className="accent-[var(--primary)]"
            />
            {label}
          </label>
        ))}
        {!compact && !value.showAreas && (
          <p className="text-meta text-[0.72rem]">{t("areasHint")}</p>
        )}
      </fieldset>
    </div>
  );
}
