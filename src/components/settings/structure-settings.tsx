"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Run } from "@/components/board/use-board-actions";
import type { Board } from "@/core/db/schema";
import { updateStructureViewAction } from "@/modules/boards/actions-boards";
import type { StructureViewInput } from "@/modules/boards/validation";
import { StructureViewFields } from "./structure-view-fields";

/** The board's view of the structure, as a card on the settings page. */
export function StructureSettings({
  board,
  canManage,
  run,
}: {
  board: Board;
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.structure");
  const current: StructureViewInput = {
    structureLevels: board.structureLevels as StructureViewInput["structureLevels"],
    showKind: board.showKind,
    showThemes: board.showThemes,
    showAreas: board.showAreas,
    swimlaneBy: board.swimlaneBy as StructureViewInput["swimlaneBy"],
  };
  const [value, setValue] = useState<StructureViewInput>(current);
  const dirty = (Object.keys(current) as Array<keyof StructureViewInput>).some(
    (key) => value[key] !== current[key],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => updateStructureViewAction({ boardId: board.id, ...value }));
          }}
          className="flex max-w-xl flex-col gap-4"
        >
          <StructureViewFields
            value={value}
            onChange={setValue}
            disabled={!canManage}
            withSwimlanes={board.mode === "kanban"}
          />
          {canManage && (
            <div>
              <Button type="submit" size="sm" disabled={!dirty}>
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
