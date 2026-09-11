"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COLUMN_CATEGORIES, type Column, type ColumnCategory } from "@/core/db/schema";
import {
  createColumnAction,
  deleteColumnAction,
  reorderColumnsAction,
  updateColumnAction,
} from "@/modules/boards/actions-boards";
import type { Run } from "@/components/board/use-board-actions";

/**
 * The board's columns: name, what the column means to the metrics, its
 * WIP limit, and the order. Deleting one asks where its cards go, so a
 * column is never removed with work still in it.
 */
export function ColumnsEditor({
  boardId,
  columns,
  canManage,
  run,
}: {
  boardId: string;
  columns: Column[];
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.columns");
  const categories = useTranslations("boardSettings.category");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ColumnCategory>("todo");
  const [limit, setLimit] = useState("");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() =>
      createColumnAction({ boardId, name, category, wipLimit: limit ? Number(limit) : null }),
    );
    if (ok) {
      setName("");
      setLimit("");
    }
  }

  function move(index: number, direction: -1 | 1) {
    const ids = columns.map((c) => c.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run(() => reorderColumnsAction({ boardId, columnIds: ids }));
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-hairline flex flex-col divide-y">
        {columns.map((column, index) => (
          <ColumnRow
            key={column.id}
            column={column}
            columns={columns}
            canManage={canManage}
            onUp={index > 0 ? () => move(index, -1) : undefined}
            onDown={index < columns.length - 1 ? () => move(index, 1) : undefined}
            run={run}
          />
        ))}
      </ul>
      {canManage && columns.length < 12 && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-label">{t("name")}</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              className="h-9 w-44 text-[0.8125rem]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-label">{t("category")}</span>
            <NativeSelect
              variant="sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as ColumnCategory)}
              className="w-36"
            >
              {COLUMN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categories(c)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-label">{t("wip")}</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-9 w-20 text-[0.8125rem]"
            />
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </div>
  );
}

function ColumnRow({
  column,
  columns,
  canManage,
  onUp,
  onDown,
  run,
}: {
  column: Column;
  columns: Column[];
  canManage: boolean;
  onUp?: () => void;
  onDown?: () => void;
  run: Run;
}) {
  const t = useTranslations("boardSettings.columns");
  const categories = useTranslations("boardSettings.category");
  const [name, setName] = useState(column.name);
  const [category, setCategory] = useState<ColumnCategory>(column.category as ColumnCategory);
  const [limit, setLimit] = useState(column.wipLimit?.toString() ?? "");
  const [target, setTarget] = useState(columns.find((c) => c.id !== column.id)?.id ?? "");
  const dirty =
    name !== column.name ||
    category !== column.category ||
    (limit || null) !== (column.wipLimit?.toString() ?? null);

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("up")}
          onClick={onUp}
          disabled={!onUp || !canManage}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("down")}
          onClick={onDown}
          disabled={!onDown || !canManage}
        >
          <ArrowDown />
        </Button>
      </span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        disabled={!canManage}
        aria-label={t("name")}
        className="h-9 w-44 text-[0.8125rem]"
      />
      <NativeSelect
        variant="sm"
        value={category}
        onChange={(e) => setCategory(e.target.value as ColumnCategory)}
        disabled={!canManage}
        aria-label={t("category")}
        className="w-36"
      >
        {COLUMN_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {categories(c)}
          </option>
        ))}
      </NativeSelect>
      <Input
        type="number"
        min={1}
        max={99}
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        disabled={!canManage}
        aria-label={t("wip")}
        placeholder="–"
        className="h-9 w-20 text-[0.8125rem]"
      />
      {canManage && dirty && (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            void run(() =>
              updateColumnAction({
                columnId: column.id,
                name,
                category,
                wipLimit: limit ? Number(limit) : null,
              }),
            )
          }
        >
          {t("save")}
        </Button>
      )}
      {canManage && columns.length > 2 && (
        <span className="ml-auto flex items-center gap-2">
          <NativeSelect
            variant="sm"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label={t("moveCardsTo")}
            className="w-36"
          >
            {columns
              .filter((c) => c.id !== column.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </NativeSelect>
          <ConfirmButton
            title={t("deleteTitle", { name: column.name })}
            body={t("deleteBody", { into: columns.find((c) => c.id === target)?.name ?? "" })}
            confirmLabel={t("deleteConfirm")}
            onConfirm={() =>
              run(() => deleteColumnAction({ columnId: column.id, moveCardsTo: target }))
            }
            variant="ghost"
            size="sm"
          >
            {t("delete")}
          </ConfirmButton>
        </span>
      )}
    </li>
  );
}
