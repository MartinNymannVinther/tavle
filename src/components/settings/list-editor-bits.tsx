"use client";

import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { themeSwatch } from "@/components/board/tokens";
import { THEME_COLORS, type ThemeColor } from "@/core/db/schema";
import type { Member } from "@/modules/boards/types";
import { cn } from "@/lib/utils";

/** The eight swatches a theme may pick from, as a radio group. */
export function Swatches({
  value,
  onChange,
}: {
  value: ThemeColor;
  onChange: (color: ThemeColor) => void;
}) {
  const t = useTranslations("boardSettings.themes");
  return (
    <span className="flex items-center gap-1" role="radiogroup" aria-label={t("color")}>
      {THEME_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={t(`colors.${color}`)}
          onClick={() => onChange(color)}
          className={cn(
            "focus-visible:ring-ring size-6 rounded-full border-2 transition focus-visible:ring-2 focus-visible:outline-none",
            value === color ? "border-foreground" : "border-transparent",
          )}
          style={{ background: themeSwatch(color) }}
        />
      ))}
    </span>
  );
}

/** Who answers for a theme or an area: a member, or nobody yet. */
export function OwnerSelect({
  value,
  onChange,
  members,
  label,
}: {
  value: string;
  onChange: (userId: string) => void;
  members: Member[];
  label: string;
}) {
  const lists = useTranslations("boardSettings.lists");
  return (
    <NativeSelect
      variant="sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="w-40"
    >
      <option value="">{lists("noOwner")}</option>
      {members.map((member) => (
        <option key={member.userId} value={member.userId}>
          {member.name}
        </option>
      ))}
    </NativeSelect>
  );
}
