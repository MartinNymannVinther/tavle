"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBoardActions } from "@/components/board/use-board-actions";
import { createBoardAction } from "@/modules/boards/actions-boards";
import type { StructureViewInput } from "@/modules/boards/validation";
import { DEFAULT_VIEW, StructureViewFields } from "@/components/settings/structure-view-fields";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** WEB from "Webshop", APP from "Medlemsapp": a suggestion, never a rule. */
function suggestKey(name: string): string {
  const letters = name
    .toUpperCase()
    .replaceAll("Æ", "AE")
    .replaceAll("Ø", "OE")
    .replaceAll("Å", "AA")
    .replace(/[^A-Z0-9 ]/g, "");
  const words = letters.split(" ").filter(Boolean);
  const raw = words.length >= 2 ? words.map((w) => w[0]).join("") : (words[0] ?? "");
  const key = raw.slice(0, 4);
  return /^[A-Z]/.test(key) ? key : "";
}

/**
 * A new board in one dialog: a name, a short key for the card numbers and
 * the one choice that shapes everything after it — a flow, or sprints.
 */
export function NewBoardDialog({ aiAvailable }: { aiAvailable: boolean }) {
  const t = useTranslations("boards.new");
  const modes = useTranslations("boards.mode");
  const structure = useTranslations("boardSettings.structure");
  const router = useRouter();
  const { run } = useBoardActions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [mode, setMode] = useState<"kanban" | "scrum">("kanban");
  const [firstArea, setFirstArea] = useState("");
  const [view, setView] = useState<StructureViewInput>(DEFAULT_VIEW);
  const [aiStart, setAiStart] = useState(false);
  const [pending, setPending] = useState(false);
  // The starting point proposes features, so a cards-only board has
  // nowhere to put it — and without a model the promise would be empty.
  const aiPossible = aiAvailable && view.structureLevels !== "card";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const wantsAi = aiStart && aiPossible;
    const ok = await run(
      () => createBoardAction({ name, key, mode, firstArea, ...view }),
      (boardId) => {
        setOpen(false);
        // Straight into the AI starting point when asked: the backlog
        // opens with the bootstrap dialog already up (docs/adr/0021).
        router.push(wantsAi ? `/boards/${boardId}/backlog?ai=start` : `/boards/${boardId}`);
      },
    );
    setPending(false);
    if (ok) {
      setName("");
      setKey("");
      setKeyTouched(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t("cta")}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="board-name">{t("name")}</FieldLabel>
              <Input
                id="board-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!keyTouched) setKey(suggestKey(event.target.value));
                }}
                required
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="board-key">{t("key")}</FieldLabel>
              <Input
                id="board-key"
                value={key}
                onChange={(event) => {
                  setKeyTouched(true);
                  setKey(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  );
                }}
                required
                pattern="[A-Z][A-Z0-9]{1,5}"
                className="w-32 font-mono uppercase"
              />
              <FieldDescription>{t("keyHint", { key: key || "WEB" })}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="board-first-area">{t("firstArea")}</FieldLabel>
              <Input
                id="board-first-area"
                value={firstArea}
                onChange={(event) => setFirstArea(event.target.value)}
                required
                maxLength={40}
                placeholder={t("firstAreaPlaceholder")}
              />
              <FieldDescription>{t("firstAreaHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("modeLabel")}</legend>
            {(["kanban", "scrum"] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  "border-border flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  mode === option ? "border-primary bg-accent/60" : "hover:bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex flex-col gap-0.5 text-sm">
                  <span className="font-semibold">{modes(option)}</span>
                  <span className="text-meta text-2sm leading-snug">{t(`${option}Hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{structure("title")}</legend>
            <p className="text-meta mb-1 text-2sm leading-snug">{structure("body")}</p>
            <StructureViewFields value={view} onChange={setView} compact />
          </fieldset>
          <label
            className={cn("flex items-start gap-2 text-sm", !aiPossible && "text-meta")}
            aria-disabled={!aiPossible}
          >
            <input
              type="checkbox"
              checked={aiStart && aiPossible}
              disabled={!aiPossible}
              onChange={(event) => setAiStart(event.target.checked)}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <span>
              {t("aiStart")}
              <span className="text-meta block text-xs">
                {!aiAvailable
                  ? t("aiStartNoModel")
                  : aiPossible
                    ? t("aiStartHint")
                    : t("aiStartNeedsLevels")}
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !name.trim() || key.length < 2 || !firstArea.trim()}
            >
              {t("submit")}
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
