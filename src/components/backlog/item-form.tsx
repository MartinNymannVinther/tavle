"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeChip } from "@/components/board/bits";
import type { Run } from "@/components/board/use-board-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ENABLER_TYPES, type EnablerType, type ItemLevel, type Kind } from "@/core/db/schema";
import { createItemAction } from "@/modules/boards/actions-structure";
import { titleWarnings } from "@/modules/boards/structure/rules";
import { structureView } from "@/modules/boards/structure/view";
import type { BoardFull } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { quarterOptions } from "./quarters";

/** What the form reads from the board: enough to place the new item. */
export type ItemFormSource = Pick<BoardFull, "board" | "themes" | "areas" | "items">;

/**
 * A new epic or feature. The form asks for what the rules require — a
 * title that reads as a result, and when it is done — and shows the
 * title warning as it is typed rather than after. A feature can be
 * created under an epic and takes its area and themes; without one it
 * needs an area, and the form says so.
 */
export function ItemForm({
  full,
  level,
  parentId,
  targetQuarter: quarterPrefill,
  trigger,
  run,
  onCreated,
}: {
  full: ItemFormSource;
  level: ItemLevel;
  /** For a feature: the epic it starts under, if any. */
  parentId?: string | null;
  /** For an epic: the quarter it starts aimed at — the roadmap's "+" fills this in. */
  targetQuarter?: string;
  trigger: React.ReactElement;
  run: Run;
  /** The page follows the new item, so what was just made is what is looked at. */
  onCreated?: (item: { id: string; parentId: string | null }) => void;
}) {
  const t = useTranslations("boards.itemForm");
  const s = useTranslations("boards.structure");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [parent, setParent] = useState(parentId ?? "");
  const [areaId, setAreaId] = useState(full.areas.find((a) => a.active)?.id ?? "");
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("business");
  const [enablerType, setEnablerType] = useState<EnablerType | "">("");
  const [targetQuarter, setTargetQuarter] = useState(quarterPrefill ?? "");

  const view = structureView(full.board);
  const epics = view.epics
    ? full.items.filter((i) => i.level === "epic" && i.state === "open")
    : [];
  const areas = full.areas.filter((a) => a.active);
  const themes = view.themes ? full.themes.filter((theme) => theme.active) : [];
  const categoryNames = [...full.themes.map((x) => x.name), ...full.areas.map((a) => a.name)];
  const warnings = titleWarnings(title, categoryNames);
  const parentChosen = level === "feature" && parent;
  // Rule 3 is the person's to meet while areas are shown; hidden, the service settles it.
  const needsArea = view.areas && !parentChosen && !areaId;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(
      () =>
        createItemAction({
          boardId: full.board.id,
          level,
          title,
          doneWhen,
          kind,
          enablerType: kind === "enabler" ? enablerType || null : null,
          parentId: level === "feature" ? parent || null : null,
          ...(parentChosen ? {} : { areaId: view.areas ? areaId || null : null, themeIds }),
          targetQuarter: level === "epic" ? targetQuarter || null : null,
        }),
      (created) =>
        onCreated?.({ id: created.id, parentId: level === "feature" ? parent || null : null }),
    );
    setPending(false);
    if (ok) {
      setOpen(false);
      setTitle("");
      setDoneWhen("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(level === "epic" ? "newEpic" : "newFeature")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="item-title">{t("title")}</FieldLabel>
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                placeholder={t("titlePlaceholder")}
              />
              <p className={cn("text-xs", warnings.length ? "text-warning" : "text-meta")}>
                {warnings.length ? s("looksLikeTheme") : t("titleHint")}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="item-done-when">{t("doneWhen")}</FieldLabel>
              <Textarea
                id="item-done-when"
                value={doneWhen}
                onChange={(e) => setDoneWhen(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t("doneWhenPlaceholder")}
              />
              <p className="text-meta text-xs">{t("doneWhenHint")}</p>
            </Field>
            {level === "feature" && view.epics && (
              <Field>
                <FieldLabel htmlFor="item-parent">{s("epic")}</FieldLabel>
                <NativeSelect
                  id="item-parent"
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">{s("noParent")}</option>
                  {epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {full.board.key}-{epic.number} · {epic.title}
                    </option>
                  ))}
                </NativeSelect>
                {parent && <p className="text-meta text-xs">{t("inherits")}</p>}
              </Field>
            )}
            {!parentChosen && (
              <>
                {view.areas && (
                  <Field>
                    <FieldLabel htmlFor="item-area">
                      {s("area")}
                      {needsArea && (
                        <span className="text-destructive"> · {s("areaRequired")}</span>
                      )}
                    </FieldLabel>
                    <NativeSelect
                      id="item-area"
                      value={areaId}
                      onChange={(e) => setAreaId(e.target.value)}
                      required
                    >
                      <option value="">{s("noArea")}</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                {themes.length > 0 && (
                  <Field>
                    <FieldLabel>{s("themes")}</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {themes.map((theme) => {
                        const on = themeIds.includes(theme.id);
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setThemeIds(
                                on
                                  ? themeIds.filter((id) => id !== theme.id)
                                  : [...themeIds, theme.id],
                              )
                            }
                            className={cn("rounded-full transition", !on && "opacity-45")}
                          >
                            <ThemeChip theme={theme} />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              {view.kind && (
                <Field>
                  <FieldLabel htmlFor="item-kind">{s("kindLabel")}</FieldLabel>
                  <NativeSelect
                    id="item-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as Kind)}
                  >
                    <option value="business">{s("kind.business")}</option>
                    <option value="enabler">{s("kind.enabler")}</option>
                  </NativeSelect>
                </Field>
              )}
              {view.kind && kind === "enabler" ? (
                <Field>
                  <FieldLabel htmlFor="item-enabler-type">{s("enablerTypeLabel")}</FieldLabel>
                  <NativeSelect
                    id="item-enabler-type"
                    value={enablerType}
                    onChange={(e) => setEnablerType(e.target.value as EnablerType | "")}
                  >
                    <option value="">{s("enablerType.none")}</option>
                    {ENABLER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {s(`enablerType.${type}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : level === "epic" ? (
                <Field>
                  <FieldLabel htmlFor="item-quarter">{s("targetQuarter")}</FieldLabel>
                  <NativeSelect
                    id="item-quarter"
                    value={targetQuarter}
                    onChange={(e) => setTargetQuarter(e.target.value)}
                  >
                    <option value="">{s("noQuarter")}</option>
                    {/* A prefill from the roadmap may name a quarter outside the coming ones. */}
                    {[
                      ...(quarterPrefill && !quarterOptions().includes(quarterPrefill)
                        ? [quarterPrefill]
                        : []),
                      ...quarterOptions(),
                    ].map((quarter) => (
                      <option key={quarter} value={quarter}>
                        {quarter}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !title.trim() || needsArea}>
              {t("create")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
