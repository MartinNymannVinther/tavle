"use client";

import { Plus, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAi } from "@/modules/ai/read-client";
import type { QuickAssist } from "@/modules/ai/assists";
import { Link } from "@/i18n/navigation";
import type { StructureLookup } from "./card-chips";
import { placesOf, WhereSelect } from "./quick-add-where";
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
 * stand as one meta line of links. It is a read over its own route
 * (docs/adr/0034), so the card the person adds in the meantime never
 * waits for the model, and a new keystroke abandons the old question.
 * Nothing is written; without a model nothing happens at all.
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
  const locale = useLocale();
  const { features, areas, values } = placesOf(structure);
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

  // The navigator can point at a closed feature, and a closed feature
  // takes nothing more. The select names it anyway and the add is
  // refused here, in plain sight, rather than by a toast about something
  // the control never mentioned. A place that has gone altogether falls
  // back to the first one the select does offer, so what is named and
  // what is written are never two different things.
  const chosenFeatureId = where.startsWith("f:") ? where.slice(2) : "";
  const closedTarget =
    chosenFeatureId && !features.some((feature) => feature.id === chosenFeatureId)
      ? structure.items.find(
          (item) =>
            item.level === "feature" && item.id === chosenFeatureId && item.state === "closed",
        )
      : undefined;
  const place = values.includes(where) || closedTarget ? where : (values[0] ?? "");

  // The quiet assist's bookkeeping: one timer, one ticket so a stale
  // answer is dropped, one call in flight that a new keystroke abandons,
  // and one latch so a modelless installation is asked once.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticket = useRef(0);
  const flight = useRef<AbortController | null>(null);
  const noModel = useRef(false);
  const touchedRef = useRef(false);
  const [assist, setAssist] = useState<QuickAssist | null>(null);
  const [suggested, setSuggested] = useState(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flight.current?.abort();
    },
    [],
  );

  /** Lets go of the question asked: no timer, no answer, no call in the air. */
  function abandon() {
    ticket.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    flight.current?.abort();
    flight.current = null;
  }

  function scheduleAssist(value: string) {
    if (!boardId || !choice || noModel.current) return;
    abandon();
    const trimmed = value.trim();
    if (trimmed.length < 8) return;
    timer.current = setTimeout(() => void ask(trimmed), 800);
  }

  async function ask(value: string) {
    const mine = ++ticket.current;
    const controller = new AbortController();
    flight.current = controller;
    const result = await askAi<QuickAssist>(
      "quick-assist",
      { boardId, title: value },
      { locale, signal: controller.signal },
    );
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || (choice && !place) || closedTarget) return;
    // A late answer must not move anything after the card exists.
    abandon();
    setPending(true);
    const [kind, id] = place.split(":");
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

  /** Closing the form lets go of the assist too; only Escape throws the sentence away. */
  function close(clearTitle: boolean) {
    abandon();
    setOpen(false);
    if (clearTitle) setTitle("");
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
          if (event.key === "Escape") close(true);
        }}
        placeholder={placeholder ?? t("placeholder")}
        maxLength={160}
        aria-label={t("label")}
        className="h-9 text-2sm"
      />
      {choice && (
        <WhereSelect
          structure={structure}
          value={place}
          closedTarget={closedTarget}
          onChange={(value) => {
            touchedRef.current = true;
            setSuggested(false);
            setWhere(value);
          }}
        />
      )}
      {closedTarget && (
        <p className="text-meta text-2xs">{t("closedNote", { title: closedTarget.title })}</p>
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
        <Button
          type="submit"
          size="sm"
          disabled={pending || !title.trim() || (choice && !place) || Boolean(closedTarget)}
        >
          {t("add")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => close(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
