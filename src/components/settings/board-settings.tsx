"use client";

import { useState } from "react";
import { StructureSettings } from "./structure-settings";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBoardActions } from "@/components/board/use-board-actions";
import type { BoardFull } from "@/modules/boards/types";
import {
  archiveBoardAction,
  deleteBoardAction,
  restoreBoardAction,
  updateBoardAction,
} from "@/modules/boards/actions-boards";
import { useRouter } from "@/i18n/navigation";
import { AreasEditor } from "./areas-editor";
import { ColumnsEditor } from "./columns-editor";
import { ThemesEditor } from "./themes-editor";

/**
 * Everything about the board that is not a card: its name and words,
 * its columns, the two closed lists of the structure, and the way out.
 * Members can read it all; owners and admins can change it, because the
 * shape of the board is the team's agreement, not one person's.
 */
export function BoardSettings({ full, canManage }: { full: BoardFull; canManage: boolean }) {
  const t = useTranslations("boardSettings");
  const router = useRouter();
  const { run } = useBoardActions();
  const { board } = full;
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [length, setLength] = useState(String(board.sprintLengthDays));
  const [reviewDays, setReviewDays] = useState(String(board.epicReviewDays));
  const dirty =
    name !== board.name ||
    description !== board.description ||
    Number(length) !== board.sprintLengthDays ||
    Number(reviewDays) !== board.epicReviewDays;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("about.title")}</CardTitle>
          <CardDescription>{t("about.body", { key: board.key })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                updateBoardAction({
                  boardId: board.id,
                  name,
                  description,
                  sprintLengthDays: Number(length) || 14,
                  epicReviewDays: Number(reviewDays) || 180,
                }),
              );
            }}
            className="flex max-w-xl flex-col gap-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="board-settings-name">{t("about.name")}</FieldLabel>
                <Input
                  id="board-settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  disabled={!canManage}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="board-settings-description">
                  {t("about.description")}
                </FieldLabel>
                <Textarea
                  id="board-settings-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={!canManage}
                />
              </Field>
              {board.mode === "scrum" && (
                <Field>
                  <FieldLabel htmlFor="board-settings-length">{t("about.sprintLength")}</FieldLabel>
                  <Input
                    id="board-settings-length"
                    type="number"
                    min={1}
                    max={60}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    disabled={!canManage}
                    className="w-24"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="board-settings-review">{t("about.reviewDays")}</FieldLabel>
                <Input
                  id="board-settings-review"
                  type="number"
                  min={7}
                  max={730}
                  value={reviewDays}
                  onChange={(e) => setReviewDays(e.target.value)}
                  disabled={!canManage}
                  className="w-24"
                />
                <p className="text-meta text-[0.72rem]">{t("about.reviewDaysHint")}</p>
              </Field>
            </FieldGroup>
            {canManage && (
              <div>
                <Button type="submit" size="sm" disabled={!dirty || !name.trim()}>
                  {t("about.save")}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <StructureSettings board={board} canManage={canManage} run={run} />

      <Card>
        <CardHeader>
          <CardTitle>{t("columns.title")}</CardTitle>
          <CardDescription>{t("columns.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnsEditor
            boardId={board.id}
            columns={full.columns}
            canManage={canManage}
            run={run}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("themes.title")}</CardTitle>
          <CardDescription>{t("themes.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemesEditor
            boardId={board.id}
            themes={full.themes}
            members={full.members}
            canManage={canManage}
            run={run}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("areas.title")}</CardTitle>
          <CardDescription>{t("areas.body")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AreasEditor
            boardId={board.id}
            areas={full.areas}
            members={full.members}
            canManage={canManage}
            run={run}
          />
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("danger.title")}</CardTitle>
            <CardDescription>
              {board.archivedAt ? t("danger.archivedBody") : t("danger.body")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {board.archivedAt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void run(() => restoreBoardAction({ boardId: board.id }))}
              >
                {t("danger.restore")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void run(
                    () => archiveBoardAction({ boardId: board.id }),
                    () => router.push("/boards"),
                  )
                }
              >
                {t("danger.archive")}
              </Button>
            )}
            <ConfirmButton
              title={t("danger.deleteTitle", { name: board.name })}
              body={t("danger.deleteBody")}
              confirmLabel={t("danger.deleteConfirm")}
              onConfirm={() =>
                run(
                  () => deleteBoardAction({ boardId: board.id }),
                  () => router.push("/boards"),
                )
              }
            >
              {t("danger.delete")}
            </ConfirmButton>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
