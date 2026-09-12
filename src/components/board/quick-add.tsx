"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { StructureLookup } from "./card-chips";
import { cn } from "@/lib/utils";

/** Where a new card goes in the structure: part of a feature, or on its own in an area. */
export type Place = { featureId?: string; areaId?: string };

/**
 * A new card in two fields. A title, and where it belongs — a feature, or
 * an area when it has no parent — because rule 3 of the structure holds
 * from the first card and the tool never invents a "Diverse" to put it
 * in. The place is remembered between cards; the title keeps what was
 * typed if the write fails, so a sentence is never lost to a blink.
 */
export function QuickAdd({
  onAdd,
  structure,
  placeholder,
  defaultWhere,
  fixed,
  compact,
}: {
  onAdd: (title: string, place: Place) => Promise<boolean>;
  structure: StructureLookup;
  placeholder?: string;
  /** Where the card starts out, as the select's value: `f:<featureId>` or `a:<areaId>`. */
  defaultWhere?: string;
  /** The place is decided by where the form stands (a feature's column); no select is shown. */
  fixed?: Place;
  /** A smaller opener, for a cell on the map. */
  compact?: boolean;
}) {
  const t = useTranslations("boards.quickAdd");
  const { view } = structure;
  const features = view.features
    ? structure.items.filter((i) => i.level === "feature" && i.state === "open")
    : [];
  const areas = view.areas ? structure.areas.filter((a) => a.active) : [];
  const choice = !fixed && (features.length > 0 || areas.length > 0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [where, setWhere] = useState<string>(defaultWhere ?? (areas[0] ? `a:${areas[0].id}` : ""));
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || (choice && !where)) return;
    setPending(true);
    const [kind, id] = where.split(":");
    const ok = await onAdd(
      trimmed,
      fixed ?? (!choice || !id ? {} : kind === "f" ? { featureId: id } : { areaId: id }),
    );
    setPending(false);
    if (ok) setTitle("");
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={compact ? "xs" : "sm"}
        className={cn("text-meta w-full justify-start", compact && "px-1")}
        onClick={() => setOpen(true)}
      >
        <Plus data-slot="icon" />
        {t("open")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder={placeholder ?? t("placeholder")}
        maxLength={160}
        aria-label={t("label")}
        className="h-9 text-[0.8125rem]"
      />
      {choice && (
        <NativeSelect
          variant="sm"
          value={where}
          onChange={(event) => setWhere(event.target.value)}
          aria-label={t("where")}
        >
          {features.length > 0 && (
            <optgroup label={t("partOfFeature")}>
              {features.map((feature) => (
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
      )}
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={pending || !title.trim() || (choice && !where)}>
          {t("add")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
