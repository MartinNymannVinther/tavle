"use client";

import { Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { proposeQuickAssistAction } from "@/modules/ai/actions-assists";
import type { QuickAssist } from "@/modules/ai/assists";
import { Link } from "@/i18n/navigation";
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
 *
 * With a model set up, a pause in the typing quietly asks it where the
 * card belongs and whether it already exists (docs/adr/0025): the select
 * moves — never over the person's own choice — and probable duplicates
 * stand as one meta line of links. Nothing is written; without a model
 * nothing happens at all.
 */
export function QuickAdd({
  onAdd,
  structure,
  placeholder,
  defaultWhere,
  fixed,
  compact,
  boardId,
  boardKey,
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
  /** The board, for the quiet assist; without it the form is exactly the two fields. */
  boardId?: string;
  boardKey?: string;
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
  // The place follows where the person is looking, but a half-typed
  // sentence is theirs: a navigator click retargets the select and
  // leaves the title standing.
  const [seedWhere, setSeedWhere] = useState(defaultWhere);
  if (seedWhere !== defaultWhere) {
    setSeedWhere(defaultWhere);
    if (defaultWhere) setWhere(defaultWhere);
  }

  // The quiet assist's bookkeeping: one timer, one ticket so a stale
  // answer is dropped, one latch so a modelless installation is asked once.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticket = useRef(0);
  const noModel = useRef(false);
  const touchedRef = useRef(false);
  const [assist, setAssist] = useState<QuickAssist | null>(null);
  const [suggested, setSuggested] = useState(false);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function scheduleAssist(value: string) {
    if (!boardId || !choice || noModel.current) return;
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed.length < 8) return;
    timer.current = setTimeout(() => void ask(trimmed), 800);
  }

  async function ask(value: string) {
    const mine = ++ticket.current;
    const result = await proposeQuickAssistAction({ boardId, title: value });
    if (mine !== ticket.current) return;
    if (!result.ok) {
      if (result.error === "noModel") noModel.current = true;
      return;
    }
    setAssist(result.proposal);
    if (result.proposal.place && !touchedRef.current) {
      setWhere(
        "featureId" in result.proposal.place
          ? `f:${result.proposal.place.featureId}`
          : `a:${result.proposal.place.areaId}`,
      );
      setSuggested(true);
    }
  }

  // The features stand under their epics, as in the navigator, so the
  // select reads as the decomposition rather than as an unsorted pile.
  const epics = view.epics ? structure.items.filter((i) => i.level === "epic") : [];
  const featureGroups = epics
    .map((epic) => ({
      key: epic.id,
      label: epic.title,
      features: features.filter((f) => f.parentId === epic.id),
    }))
    .filter((group) => group.features.length > 0);
  const grouped = new Set(featureGroups.flatMap((g) => g.features.map((f) => f.id)));
  const loose = features.filter((f) => !grouped.has(f.id));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || (choice && !where)) return;
    // A late answer must not move anything after the card exists.
    ticket.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setPending(true);
    const [kind, id] = where.split(":");
    const ok = await onAdd(
      trimmed,
      fixed ?? (!choice || !id ? {} : kind === "f" ? { featureId: id } : { areaId: id }),
    );
    setPending(false);
    if (ok) {
      setTitle("");
      setAssist(null);
      setSuggested(false);
    }
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
        onChange={(event) => {
          setTitle(event.target.value);
          scheduleAssist(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder={placeholder ?? t("placeholder")}
        maxLength={160}
        aria-label={t("label")}
        className="h-9 text-2sm"
      />
      {choice && (
        <NativeSelect
          variant="sm"
          value={where}
          onChange={(event) => {
            touchedRef.current = true;
            setSuggested(false);
            setWhere(event.target.value);
          }}
          aria-label={t("where")}
        >
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
      )}
      {suggested && (
        <p className="text-meta flex items-center gap-1 text-2xs">
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {t("aiSuggested")}
        </p>
      )}
      {assist && assist.duplicates.length > 0 && boardId && (
        <p className="text-meta flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs">
          <span>{t("similar")}</span>
          {assist.duplicates.map((duplicate) => (
            <Link
              key={duplicate.number}
              href={`/boards/${boardId}/cards/${duplicate.number}`}
              className="text-primary max-w-56 truncate hover:underline"
            >
              {boardKey ? `${boardKey}-${duplicate.number}` : `#${duplicate.number}`} ·{" "}
              {duplicate.title}
            </Link>
          ))}
        </p>
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
