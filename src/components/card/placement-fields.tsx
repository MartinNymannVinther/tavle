"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeChip } from "@/components/board/bits";
import type { Run } from "@/components/board/use-board-actions";
import { NativeSelect } from "@/components/ui/native-select";
import { PropertyRow } from "@/components/ui/property-row";
import { ENABLER_TYPES, type Area, type Theme } from "@/core/db/schema";
import { placeCardAction, updateCardAction } from "@/modules/boards/actions-cards";
import { FULL_VIEW, type StructureView } from "@/modules/boards/structure/view";
import type { CardDetail, ItemView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";

/**
 * Where something belongs in the structure, as property rows that save
 * on change: its parent (one level up, or none), its area, its themes,
 * its kind. Shared by the card and by the epic and feature pages, which pass
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
  view = FULL_VIEW,
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
  /** Which fields the board shows; a hidden one is left out of the panel. */
  view?: StructureView;
  onPlace: (placement: Placement) => void;
  onKind: (fields: KindFields) => void;
}) {
  const t = useTranslations("boards.structure");
  const [cascade, setCascade] = useState(false);
  const activeAreas = areas.filter((a) => a.active || a.id === areaId);
  const activeThemes = view.themes
    ? themes.filter((theme) => theme.active || themeIds.includes(theme.id))
    : [];
  const needsArea = view.areas && !parent?.value && !areaId;

  function toggleTheme(themeId: string) {
    const next = themeIds.includes(themeId)
      ? themeIds.filter((id) => id !== themeId)
      : [...themeIds, themeId];
    onPlace({ themeIds: next, applyToChildren: cascade });
  }

  return (
    <>
      {parent && (
        <PropertyRow label={parent.label} htmlFor="place-parent">
          <NativeSelect
            id="place-parent"
            variant="xs"
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
        </PropertyRow>
      )}

      {view.areas && (
        <PropertyRow
          label={t("area")}
          htmlFor="place-area"
          hint={
            needsArea ? <span className="text-destructive">{t("areaRequired")}</span> : undefined
          }
        >
          <NativeSelect
            id="place-area"
            variant="xs"
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
        </PropertyRow>
      )}

      {activeThemes.length > 0 && (
        <PropertyRow label={t("themes")} className="items-start [&>span]:pt-1.5">
          <div className="flex min-h-8 flex-wrap items-center gap-1.5">
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
        </PropertyRow>
      )}

      {offerCascade && (view.areas || view.themes) && (
        <label className="text-meta flex items-center gap-2 py-1 text-[0.72rem]">
          <input
            type="checkbox"
            checked={cascade}
            onChange={(event) => setCascade(event.target.checked)}
          />
          {t("applyToChildren")}
        </label>
      )}

      {view.kind && (
        <PropertyRow label={t("kindLabel")} htmlFor="place-kind">
          <div className="flex gap-2">
            <NativeSelect
              id="place-kind"
              variant="xs"
              value={kind}
              onChange={(event) =>
                onKind({ kind: event.target.value as "business" | "enabler", enablerType: null })
              }
            >
              <option value="business">{t("kind.business")}</option>
              <option value="enabler">{t("kind.enabler")}</option>
            </NativeSelect>
            {kind === "enabler" && (
              <NativeSelect
                id="place-enabler-type"
                variant="xs"
                aria-label={t("enablerTypeLabel")}
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
            )}
          </div>
        </PropertyRow>
      )}

      {bug !== undefined && (
        <PropertyRow label={t("bug")} htmlFor="place-bug">
          <label className="flex h-8 items-center gap-2">
            <input
              id="place-bug"
              type="checkbox"
              checked={bug}
              onChange={(event) => onKind({ bug: event.target.checked })}
              className="accent-[var(--warning)]"
            />
            <span className={cn("text-[0.8125rem]", bug && "text-warning font-medium")}>
              {t("bugFlag")}
            </span>
          </label>
        </PropertyRow>
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
  view = FULL_VIEW,
  run,
}: {
  card: CardDetail;
  boardKey: string;
  themes: Theme[];
  areas: Area[];
  features: ItemView[];
  view?: StructureView;
  run: Run;
}) {
  const t = useTranslations("boards.structure");
  return (
    <StructureFields
      parent={
        view.features
          ? { label: t("feature"), value: card.featureId, options: features, boardKey }
          : null
      }
      view={view}
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
