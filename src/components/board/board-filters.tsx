"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Label } from "@/core/db/schema";
import type { CardView, Member } from "@/modules/boards/types";

export type Filters = { text: string; assignee: string; labelId: string };

export const NO_FILTERS: Filters = { text: "", assignee: "", labelId: "" };

/** Which cards pass the filter bar. A blank bar passes everything. */
export function applyFilters(cards: CardView[], filters: Filters): CardView[] {
  const text = filters.text.trim().toLowerCase();
  return cards.filter((card) => {
    if (text && !`${card.number} ${card.title}`.toLowerCase().includes(text)) return false;
    if (filters.assignee === "unassigned" && card.assigneeUserId) return false;
    if (
      filters.assignee &&
      filters.assignee !== "unassigned" &&
      card.assigneeUserId !== filters.assignee
    )
      return false;
    if (filters.labelId && !card.labelIds.includes(filters.labelId)) return false;
    return true;
  });
}

/**
 * Narrowing the board down: a word in the title, one person, one label.
 * Client state only; a filter is a way of looking, not a thing to share.
 */
export function BoardFilters({
  filters,
  onChange,
  members,
  labels,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  members: Member[];
  labels: Label[];
}) {
  const t = useTranslations("boards.filters");
  const active = filters.text || filters.assignee || filters.labelId;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        value={filters.text}
        onChange={(event) => onChange({ ...filters, text: event.target.value })}
        placeholder={t("search")}
        aria-label={t("search")}
        className="h-9 w-56 text-[0.8125rem]"
      />
      <NativeSelect
        variant="sm"
        value={filters.assignee}
        onChange={(event) => onChange({ ...filters, assignee: event.target.value })}
        aria-label={t("assignee")}
        className="w-44"
      >
        <option value="">{t("anyone")}</option>
        <option value="unassigned">{t("unassigned")}</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </NativeSelect>
      {labels.length > 0 && (
        <NativeSelect
          variant="sm"
          value={filters.labelId}
          onChange={(event) => onChange({ ...filters, labelId: event.target.value })}
          aria-label={t("label")}
          className="w-40"
        >
          <option value="">{t("anyLabel")}</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {active && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(NO_FILTERS)}>
          {t("clear")}
        </Button>
      )}
    </div>
  );
}
