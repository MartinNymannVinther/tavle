"use client";

import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import type { ItemView } from "@/modules/boards/types";
import type { StructureLookup } from "./card-chips";

/**
 * Where a new card goes, as one control: the open features under their
 * epics, as the navigator stands them, and the areas for a card with no
 * parent. A closed feature is not a place a card can go — but when the
 * navigator has chosen one, the select still names it, marked as closed,
 * because a control that names one place while the form aims at another
 * is worse than a refusal.
 */

export type Places = {
  features: ItemView[];
  areas: StructureLookup["areas"];
  /** Every value the select offers, so a caller can tell a real target from a stale one. */
  values: string[];
};

/** The open features and active areas this board shows for a new card. */
export function placesOf(structure: StructureLookup): Places {
  const features = structure.view.features
    ? structure.items.filter((item) => item.level === "feature" && item.state === "open")
    : [];
  const areas = structure.view.areas ? structure.areas.filter((area) => area.active) : [];
  return {
    features,
    areas,
    values: [...features.map((f) => `f:${f.id}`), ...areas.map((a) => `a:${a.id}`)],
  };
}

export function WhereSelect({
  structure,
  value,
  onChange,
  closedTarget,
}: {
  structure: StructureLookup;
  /** `f:<featureId>` or `a:<areaId>` — always one the select itself names. */
  value: string;
  onChange: (value: string) => void;
  /** The closed feature the navigator chose, named here so the refusal makes sense. */
  closedTarget?: ItemView;
}) {
  const t = useTranslations("boards.quickAdd");
  const { view } = structure;
  const { features, areas } = placesOf(structure);
  // The features stand under their epics, as in the navigator, so the
  // select reads as the decomposition rather than as an unsorted pile.
  const epics = view.epics ? structure.items.filter((item) => item.level === "epic") : [];
  const featureGroups = epics
    .map((epic) => ({
      key: epic.id,
      label: epic.title,
      features: features.filter((feature) => feature.parentId === epic.id),
    }))
    .filter((group) => group.features.length > 0);
  const grouped = new Set(featureGroups.flatMap((group) => group.features.map((f) => f.id)));
  const loose = features.filter((feature) => !grouped.has(feature.id));

  return (
    <NativeSelect
      variant="sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={t("where")}
    >
      {closedTarget && (
        <optgroup label={t("closedGroup")}>
          <option value={`f:${closedTarget.id}`}>{closedTarget.title}</option>
        </optgroup>
      )}
      {featureGroups.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.features.map((feature) => (
            <option key={feature.id} value={`f:${feature.id}`}>
              {feature.title}
            </option>
          ))}
        </optgroup>
      ))}
      {loose.length > 0 && (
        <optgroup label={featureGroups.length > 0 ? t("looseFeatures") : t("partOfFeature")}>
          {loose.map((feature) => (
            <option key={feature.id} value={`f:${feature.id}`}>
              {feature.title}
            </option>
          ))}
        </optgroup>
      )}
      {areas.length > 0 && (
        <optgroup label={view.features ? t("noParentInArea") : t("inArea")}>
          {areas.map((area) => (
            <option key={area.id} value={`a:${area.id}`}>
              {area.name}
            </option>
          ))}
        </optgroup>
      )}
    </NativeSelect>
  );
}
