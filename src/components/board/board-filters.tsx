"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CardView, PersonRef } from "@/modules/boards/types";
import type { StructureLookup } from "./card-chips";

export type Filters = {
  text: string;
  assignee: string;
  themeId: string;
  areaId: string;
  /** "", "business", "enabler" or "bug". */
  kind: string;
};

export const NO_FILTERS: Filters = { text: "", assignee: "", themeId: "", areaId: "", kind: "" };

/**
 * A hyphen and a space are the same character to someone searching: a
 * card is printed as "WEB-13" and pasted into a chat as "WEB 13", and
 * both should find it.
 */
const loose = (value: string) => value.toLowerCase().replace(/[\s-]+/g, "-");

/**
 * Which cards pass the filter bar. A blank bar passes everything. The
 * board's key is optional only because the backlog and the map call this
 * with the same cards; where it is given, the key printed on every card
 * is searchable, which is the form a person actually has to hand.
 */
export function applyFilters(cards: CardView[], filters: Filters, boardKey?: string): CardView[] {
  const text = loose(filters.text.trim());
  return cards.filter((card) => {
    const key = boardKey ? `${boardKey}-${card.number} ` : "";
    if (text && !loose(`${key}${card.number} ${card.title}`).includes(text)) return false;
    if (filters.assignee === "unassigned" && card.assigneePersonId) return false;
    if (
      filters.assignee &&
      filters.assignee !== "unassigned" &&
      card.assigneePersonId !== filters.assignee
    )
      return false;
    if (filters.themeId === "none" && card.themeIds.length > 0) return false;
    if (filters.themeId && filters.themeId !== "none" && !card.themeIds.includes(filters.themeId))
      return false;
    if (filters.areaId === "none" && card.areaId) return false;
    if (filters.areaId && filters.areaId !== "none" && card.areaId !== filters.areaId) return false;
    if (filters.kind === "bug" && !card.bug) return false;
    if ((filters.kind === "business" || filters.kind === "enabler") && card.kind !== filters.kind)
      return false;
    return true;
  });
}

export function hasFilters(filters: Filters): boolean {
  return Object.values(filters).some(Boolean);
}

/**
 * Narrowing the board down: a word in the title, one person, one theme,
 * one area, one kind or the bugs. Client state only; a filter is a way
 * of looking, not a thing to share.
 */
export function BoardFilters({
  filters,
  onChange,
  people,
  structure,
  collapsible = false,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  people: PersonRef[];
  structure: StructureLookup;
  /** In a narrow column: only the search stands out; the selects wait behind a counted "Filtre" button. */
  collapsible?: boolean;
}) {
  const t = useTranslations("boards.filters");
  const { view } = structure;
  const [open, setOpen] = useState(false);
  const themes = view.themes ? structure.themes.filter((theme) => theme.active) : [];
  const areas = view.areas ? structure.areas.filter((area) => area.active) : [];
  const chosen = [filters.assignee, filters.themeId, filters.areaId, filters.kind].filter(
    Boolean,
  ).length;
  const search = (
    <Input
      type="search"
      value={filters.text}
      onChange={(event) => onChange({ ...filters, text: event.target.value })}
      placeholder={t("search")}
      aria-label={t("search")}
      className={collapsible ? "h-8 w-40 min-w-0 flex-1 text-2sm" : "h-9 w-56 text-2sm"}
    />
  );
  const selects = (
    <>
      <NativeSelect
        variant="sm"
        value={filters.assignee}
        onChange={(event) => onChange({ ...filters, assignee: event.target.value })}
        aria-label={t("assignee")}
        className="w-40"
      >
        <option value="">{t("anyone")}</option>
        <option value="unassigned">{t("unassigned")}</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </NativeSelect>
      {themes.length > 0 && (
        <NativeSelect
          variant="sm"
          value={filters.themeId}
          onChange={(event) => onChange({ ...filters, themeId: event.target.value })}
          aria-label={t("theme")}
          className="w-40"
        >
          <option value="">{t("anyTheme")}</option>
          <option value="none">{t("noTheme")}</option>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {areas.length > 1 && (
        <NativeSelect
          variant="sm"
          value={filters.areaId}
          onChange={(event) => onChange({ ...filters, areaId: event.target.value })}
          aria-label={t("area")}
          className="w-40"
        >
          <option value="">{t("anyArea")}</option>
          <option value="none">{t("noArea")}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        variant="sm"
        value={filters.kind}
        onChange={(event) => onChange({ ...filters, kind: event.target.value })}
        aria-label={t("kind")}
        className="w-36"
      >
        <option value="">{view.kind ? t("anyKind") : t("all")}</option>
        {view.kind && <option value="business">{t("business")}</option>}
        {view.kind && <option value="enabler">{t("enabler")}</option>}
        <option value="bug">{t("bugs")}</option>
      </NativeSelect>
      {hasFilters(filters) && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(NO_FILTERS)}>
          {t("clear")}
        </Button>
      )}
    </>
  );
  if (!collapsible) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {selects}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {search}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ListFilter data-slot="icon" />
        {t("more")}
        {chosen > 0 && (
          <span className="bg-accent text-accent-foreground rounded-full px-1.5 text-2xs font-medium tabular-nums">
            {chosen}
          </span>
        )}
      </Button>
      {open && <div className="flex w-full flex-wrap items-center gap-2">{selects}</div>}
    </div>
  );
}
