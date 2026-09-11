"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelChip } from "@/components/board/bits";
import { LABEL_SWATCH } from "@/components/board/tokens";
import { LABEL_COLORS, type Label, type LabelColor } from "@/core/db/schema";
import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/modules/boards/actions-boards";
import type { Run } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";

/** The board's labels: a name and one of six colours from the family's palette. */
export function LabelsEditor({
  boardId,
  labels,
  canManage,
  run,
}: {
  boardId: string;
  labels: Label[];
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.labels");
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("moss");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => createLabelAction({ boardId, name, color }));
    if (ok) setName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-hairline flex flex-col divide-y">
        {labels.map((label) => (
          <LabelRow key={label.id} label={label} canManage={canManage} run={run} />
        ))}
        {labels.length === 0 && <li className="text-meta py-2 text-sm">{t("empty")}</li>}
      </ul>
      {canManage && labels.length < 20 && (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={30}
            placeholder={t("placeholder")}
            aria-label={t("name")}
            className="h-9 w-44 text-[0.8125rem]"
          />
          <Swatches value={color} onChange={setColor} />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </div>
  );
}

function Swatches({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}) {
  const t = useTranslations("boardSettings.labels");
  return (
    <span className="flex items-center gap-1" role="radiogroup" aria-label={t("color")}>
      {LABEL_COLORS.map((color) => (
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
          style={{ background: LABEL_SWATCH[color] }}
        />
      ))}
    </span>
  );
}

function LabelRow({ label, canManage, run }: { label: Label; canManage: boolean; run: Run }) {
  const t = useTranslations("boardSettings.labels");
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColor>(label.color as LabelColor);
  const dirty = name !== label.name || color !== label.color;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <LabelChip label={{ name: name || label.name, color }} />
      {canManage ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            aria-label={t("name")}
            className="h-9 w-44 text-[0.8125rem]"
          />
          <Swatches value={color} onChange={setColor} />
          {dirty && (
            <Button
              type="button"
              size="sm"
              onClick={() => void run(() => updateLabelAction({ labelId: label.id, name, color }))}
            >
              {t("save")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => void run(() => deleteLabelAction({ labelId: label.id }))}
          >
            {t("delete")}
          </Button>
        </>
      ) : null}
    </li>
  );
}
