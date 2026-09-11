"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeChip } from "@/components/board/bits";
import type { Run } from "@/components/board/use-board-actions";
import { NativeSelect } from "@/components/ui/native-select";
import { ENABLER_TYPES, type Area, type Theme } from "@/core/db/schema";
import { placeCardAction, updateCardAction } from "@/modules/boards/actions-cards";
import type { CardView, ItemView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";

/**
 * Where something belongs in the structure, as controls that save on
 * change: its parent (one level up, or none), its area, its themes, its
 * kind. Shared by the card and by the epic and feature pages, which pass
 * in what a parent is for them. An item without a parent needs an area,
 * so the area select is marked required when the parent is "none".
 */

export type ParentChoice = {
  label: string;
  value: string | null;
  options: Array<{ id: string; number: number; title: string }>;
  boardKey: string;
};

export type Placement = {
  parentId?: string | null;
  areaId?: string | null;
  themeIds?: string[];
  applyToChildren?: boolean;
};

export type KindFields = {
  kind?: "business" | "enabler";
  enablerType?: (typeof ENABLER_TYPES)[number] | null;
  bug?: boolean;
};

const rowClass = "flex flex-col gap-1.5";
const labelClass = "text-label text-[0.72rem] font-medium";

export function StructureFields({
  parent,
  areaId,
  themeIds,
  kind,
  enablerType,
  bug,
  themes,
  areas,
  offerCascade,
  onPlace,
  onKind,
}: {
  parent: ParentChoice | null;
  areaId: string | null;
  themeIds: string[];
  kind: string;
  enablerType: string | null;
  /** Undefined hides the flag, which epics and features have no use for. */
  bug?: boolean;
  themes: Theme[];
  areas: Area[];
  /** Rule 11: offer to take the children along when the area or themes change. */
  offerCascade?: boolean;
  onPlace: (placement: Placement) => void;
  onKind: (fields: KindFields) => void;
}) {
  const t = useTranslations("boards.structure");
  const [cascade, setCascade] = useState(false);
  const activeAreas = areas.filter((a) => a.active || a.id === areaId);
  const activeThemes = themes.filter((theme) => theme.active || themeIds.includes(theme.id));
  const needsArea = !parent?.value && !areaId;

  function toggleTheme(themeId: string) {
    const next = themeIds.includes(themeId)
      ? themeIds.filter((id) => id !== themeId)
      : [...themeIds, themeId];
    onPlace({ themeIds: next, applyToChildren: cascade });
  }

  return (
    <>
      {parent && (
        <div className={rowClass}>
          <label htmlFor="place-parent" className={labelClass}>
            {parent.label}
          </label>
          <NativeSelect
            id="place-parent"
            variant="sm"
            value={parent.value ?? ""}
            onChange={(event) => onPlace({ parentId: event.target.value || null })}
          >
            <option value="">{t("noParent")}</option>
            {parent.options.map((option) => (
              <option key={option.id} value={option.id}>
                {parent.boardKey}-{option.number} · {option.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className={rowClass}>
        <label htmlFor="place-area" className={labelClass}>
          {t("area")}
          {needsArea && <span className="text-destructive"> · {t("areaRequired")}</span>}
        </label>
        <NativeSelect
          id="place-area"
          variant="sm"
          value={areaId ?? ""}
          onChange={(event) =>
            onPlace({ areaId: event.target.value || null, applyToChildren: cascade })
          }
          className={cn(needsArea && "border-destructive")}
        >
          <option value="">{t("noArea")}</option>
          {activeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
              {area.active ? "" : ` · ${t("inactive")}`}
            </option>
          ))}
        </NativeSelect>
      </div>

      {activeThemes.length > 0 && (
        <div className={rowClass}>
          <span className={labelClass}>{t("themes")}</span>
          <div className="flex flex-wrap gap-1.5">
            {activeThemes.map((theme) => {
              const on = themeIds.includes(theme.id);
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTheme(theme.id)}
                  className={cn(
                    "focus-visible:ring-ring rounded-full ring-offset-1 transition focus-visible:ring-2 focus-visible:outline-none",
                    !on && "opacity-45 hover:opacity-80",
                  )}
                >
                  <ThemeChip theme={theme} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {offerCascade && (
        <label className="flex items-center gap-2 text-[0.78rem]">
          <input
            type="checkbox"
            checked={cascade}
            onChange={(event) => setCascade(event.target.checked)}
          />
          {t("applyToChildren")}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={rowClass}>
          <label htmlFor="place-kind" className={labelClass}>
            {t("kindLabel")}
          </label>
          <NativeSelect
            id="place-kind"
            variant="sm"
            value={kind}
            onChange={(event) =>
              onKind({ kind: event.target.value as "business" | "enabler", enablerType: null })
            }
          >
            <option value="business">{t("kind.business")}</option>
            <option value="enabler">{t("kind.enabler")}</option>
          </NativeSelect>
        </div>
        {kind === "enabler" && (
          <div className={rowClass}>
            <label htmlFor="place-enabler-type" className={labelClass}>
              {t("enablerTypeLabel")}
            </label>
            <NativeSelect
              id="place-enabler-type"
              variant="sm"
              value={enablerType ?? ""}
              onChange={(event) =>
                onKind({
                  kind: "enabler",
                  enablerType: (event.target.value || null) as KindFields["enablerType"],
                })
              }
            >
              <option value="">{t("enablerType.none")}</option>
              {ENABLER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`enablerType.${type}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      {bug !== undefined && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bug}
            onChange={(event) => onKind({ bug: event.target.checked })}
            className="accent-[var(--warning)]"
          />
          <span className={cn("font-medium", bug && "text-warning")}>{t("bugFlag")}</span>
        </label>
      )}
    </>
  );
}

/** The card's version: its feature is the parent, and it carries the bug flag. */
export function PlacementFields({
  card,
  boardKey,
  themes,
  areas,
  features,
  run,
}: {
  card: CardView;
  boardKey: string;
  themes: Theme[];
  areas: Area[];
  features: ItemView[];
  run: Run;
}) {
  const t = useTranslations("boards.structure");
  return (
    <StructureFields
      parent={{ label: t("feature"), value: card.featureId, options: features, boardKey }}
      areaId={card.areaId}
      themeIds={card.themeIds}
      kind={card.kind}
      enablerType={card.enablerType}
      bug={card.bug}
      themes={themes}
      areas={areas}
      onPlace={(placement) =>
        void run(() =>
          placeCardAction({
            cardId: card.id,
            ...(placement.parentId !== undefined ? { featureId: placement.parentId } : {}),
            ...(placement.areaId !== undefined ? { areaId: placement.areaId } : {}),
            ...(placement.themeIds !== undefined ? { themeIds: placement.themeIds } : {}),
          }),
        )
      }
      onKind={(fields) => void run(() => updateCardAction({ cardId: card.id, ...fields }))}
    />
  );
}
