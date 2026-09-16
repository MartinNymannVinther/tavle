"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Release } from "@/core/db/schema";
import { PLAN_DATE_MAX, PLAN_DATE_MIN } from "@/modules/boards/plan-dates";
import type { Run } from "@/components/board/use-board-actions";
import {
  createReleaseAction,
  deleteReleaseAction,
  updateReleaseAction,
} from "@/modules/boards/actions-releases";

/**
 * A release band, made or edited in one small dialog (docs/adr/0032):
 * a name the team would say out loud, and the date they are aiming at,
 * which may be blank because plenty of releases have no date yet.
 *
 * Deleting says what it will and will not take: the band goes, the
 * cards stay and fall back into the unreleased band. That is the one
 * fact somebody needs before pressing it.
 */
export function ReleaseForm({
  boardId,
  release,
  open,
  onOpenChange,
  run,
}: {
  boardId: string;
  /** The band being edited, or null to make a new one. */
  release: Release | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: Run;
}) {
  const t = useTranslations("map.release");
  const errors = useTranslations("boards.errors");
  // The fields start from the band that was opened. The parent keys this
  // component on that band, so React builds a fresh one each time rather
  // than the fields being pushed back into shape from an effect.
  const [name, setName] = useState(release?.name ?? "");
  const [date, setDate] = useState(release?.targetDate ?? "");
  const [pending, setPending] = useState(false);
  // A band whose name is already on the board is refused by the service.
  // Remembering which names came back taken marks the field, so the
  // dialog says what is wrong where the wrong thing is.
  const [takenNames, setTakenNames] = useState<string[]>([]);
  const taken = takenNames.includes(name.trim().toLowerCase());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const ok = await run(
      () =>
        release
          ? updateReleaseAction({ releaseId: release.id, name, targetDate: date || null })
          : createReleaseAction({ boardId, name, targetDate: date || null }),
      undefined,
      (_error, detail) => {
        if (detail === "nameTaken") {
          setTakenNames((names) => [...names, name.trim().toLowerCase()]);
        }
      },
    );
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{release ? t("editTitle") : t("newTitle")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={taken || undefined}>
              <FieldLabel htmlFor="release-name">{t("name")}</FieldLabel>
              <Input
                id="release-name"
                aria-invalid={taken || undefined}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder={t("namePlaceholder")}
                autoFocus
                required
              />
              {taken && <p className="text-destructive text-xs">{errors("nameTaken")}</p>}
            </Field>
            <Field>
              <FieldLabel htmlFor="release-date">{t("date")}</FieldLabel>
              {/* A native date field fires a change for every digit of the
                  year, so the bounds are what keep 0202 from reaching the
                  service — which refuses it too (src/modules/boards/plan-dates.ts). */}
              <Input
                id="release-date"
                type="date"
                value={date}
                min={PLAN_DATE_MIN}
                max={PLAN_DATE_MAX}
                onChange={(event) => setDate(event.target.value)}
                className="w-44"
              />
              <p className="text-meta text-xs">{t("dateHint")}</p>
            </Field>
          </FieldGroup>
          <DialogFooter className="items-center">
            {release && (
              <ConfirmButton
                title={t("deleteTitle", { name: release.name })}
                body={t("deleteBody")}
                confirmLabel={t("deleteConfirm")}
                onConfirm={() =>
                  run(() => deleteReleaseAction({ releaseId: release.id })).then((ok) => {
                    if (ok) onOpenChange(false);
                  })
                }
              >
                {t("delete")}
              </ConfirmButton>
            )}
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {release ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
