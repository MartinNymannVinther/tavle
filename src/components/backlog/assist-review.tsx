"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { TypeIcon } from "@/components/board/type-icon";
import type {
  AssistCard,
  AssistEdit,
  AssistEpic,
  AssistFeature,
  AssistProposal,
} from "@/modules/ai/backlog-assist";
import { cn } from "@/lib/utils";

/**
 * The assistant's proposal as four lists the person owns before any of
 * it exists (docs/adr/0037): every row can be unticked and every text
 * rewritten, and an edit shows what stands today beneath what it would
 * become. Only what stays ticked is saved.
 */

type On<T> = T & { on: boolean };
export type EditableAssist = {
  epics: Array<On<AssistEpic>>;
  features: Array<On<AssistFeature>>;
  cards: Array<On<AssistCard>>;
  edits: Array<On<AssistEdit>>;
};

export function toEditable(proposal: AssistProposal): EditableAssist {
  const on = <T,>(rows: T[]) => rows.map((row) => ({ ...row, on: true }));
  return {
    epics: on(proposal.epics),
    features: on(proposal.features),
    cards: on(proposal.cards),
    edits: on(proposal.edits),
  };
}

/** What stays ticked, with the person's own wording in it. */
export function keepChecked(tree: EditableAssist): AssistProposal {
  const kept = <T extends { on: boolean }>(rows: T[]) => rows.filter((row) => row.on);
  const titled = <T extends { on: boolean; title: string }>(rows: T[]) =>
    kept(rows).filter((row) => row.title.trim());
  const strip = <T extends { on: boolean }>({ on: _on, ...rest }: T) => rest;
  return {
    epics: titled(tree.epics).map((epic) => ({ ...strip(epic), title: epic.title.trim() })),
    features: titled(tree.features).map((f) => ({ ...strip(f), title: f.title.trim() })),
    cards: titled(tree.cards).map((c) => ({ ...strip(c), title: c.title.trim() })),
    edits: kept(tree.edits)
      .map((edit) => ({
        ...strip(edit),
        title: edit.title?.trim() ? edit.title.trim() : null,
        doneWhen: edit.doneWhen?.trim() ? edit.doneWhen.trim() : null,
      }))
      .filter((edit) => edit.title || edit.doneWhen),
  };
}

/** How many rows a save would write, for the button that offers it. */
export function keptCount(proposal: AssistProposal): number {
  return (
    proposal.epics.length + proposal.features.length + proposal.cards.length + proposal.edits.length
  );
}

const row = "flex items-center gap-2";
const box = "accent-[var(--primary)]";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-label mb-1 text-xs font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

export function AssistReview({
  tree,
  onChange,
}: {
  tree: EditableAssist;
  onChange: (tree: EditableAssist) => void;
}) {
  const t = useTranslations("aiAssist");
  const patch = <K extends keyof EditableAssist>(key: K, next: EditableAssist[K]) =>
    onChange({ ...tree, [key]: next });
  const set = <K extends keyof EditableAssist>(
    key: K,
    at: number,
    next: Partial<EditableAssist[K][number]>,
  ) => patch(key, tree[key].map((x, j) => (j === at ? { ...x, ...next } : x)) as EditableAssist[K]);

  return (
    <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
      {tree.epics.length > 0 && (
        <Group label={t("newEpics")}>
          {tree.epics.map((epic, i) => (
            <div key={i} className={cn("flex flex-col gap-1", !epic.on && "opacity-50")}>
              <div className={row}>
                <input
                  type="checkbox"
                  checked={epic.on}
                  onChange={(e) => set("epics", i, { on: e.target.checked })}
                  className={box}
                  aria-label={t("keepEpic", { title: epic.title })}
                />
                <TypeIcon type="epic" />
                <Input
                  value={epic.title}
                  onChange={(e) => set("epics", i, { title: e.target.value })}
                  maxLength={160}
                  className="h-8 flex-1 text-2sm font-medium"
                />
                {epic.targetQuarter && (
                  <span className="text-meta shrink-0 text-xs tabular-nums">
                    {epic.targetQuarter}
                  </span>
                )}
              </div>
              <p className="text-meta pl-6 text-xs">
                {[epic.area, ...epic.themes].filter(Boolean).join(" · ")}
                {epic.doneWhen ? ` · ${t("doneWhen")} ${epic.doneWhen}` : ""}
              </p>
            </div>
          ))}
        </Group>
      )}

      {tree.features.length > 0 && (
        <Group label={t("newFeatures")}>
          {tree.features.map((feature, i) => (
            <div key={i} className={cn("flex flex-col gap-1", !feature.on && "opacity-50")}>
              <div className={row}>
                <input
                  type="checkbox"
                  checked={feature.on}
                  onChange={(e) => set("features", i, { on: e.target.checked })}
                  className={box}
                  aria-label={t("keepFeature", { title: feature.title })}
                />
                <TypeIcon type="feature" />
                <Input
                  value={feature.title}
                  onChange={(e) => set("features", i, { title: e.target.value })}
                  maxLength={160}
                  className="h-7 flex-1 text-2sm"
                />
              </div>
              <p className="text-meta pl-6 text-xs">
                {t("under", { parent: `${feature.parentKey} · ${feature.parentTitle}` })}
                {feature.doneWhen ? ` · ${t("doneWhen")} ${feature.doneWhen}` : ""}
              </p>
            </div>
          ))}
        </Group>
      )}

      {tree.cards.length > 0 && (
        <Group label={t("newCards")}>
          {tree.cards.map((card, i) => (
            <div key={i} className={cn("flex flex-col gap-1", !card.on && "opacity-50")}>
              <div className={row}>
                <input
                  type="checkbox"
                  checked={card.on}
                  onChange={(e) => set("cards", i, { on: e.target.checked })}
                  className={box}
                  aria-label={t("keepCard", { title: card.title })}
                />
                <TypeIcon type="card" />
                <Input
                  value={card.title}
                  onChange={(e) => set("cards", i, { title: e.target.value })}
                  maxLength={160}
                  className="h-7 flex-1 text-2sm"
                />
              </div>
              <p className="text-meta pl-6 text-xs">
                {t("under", { parent: `${card.parentKey} · ${card.parentTitle}` })}
              </p>
            </div>
          ))}
        </Group>
      )}

      {tree.edits.length > 0 && (
        <Group label={t("edits")}>
          {tree.edits.map((edit, i) => (
            <div
              key={i}
              className={cn(
                "border-border flex flex-col gap-1.5 rounded-lg border p-2.5",
                !edit.on && "opacity-50",
              )}
            >
              <div className={row}>
                <input
                  type="checkbox"
                  checked={edit.on}
                  onChange={(e) => set("edits", i, { on: e.target.checked })}
                  className={box}
                  aria-label={t("keepEdit", { key: edit.key })}
                />
                <TypeIcon type={edit.level} />
                <span className="text-meta shrink-0 text-xs tabular-nums">{edit.key}</span>
                <span className="truncate text-2sm">{edit.currentTitle}</span>
              </div>
              {edit.title !== null && (
                <EditField
                  label={t("editTitle")}
                  today={edit.currentTitle}
                  value={edit.title}
                  max={160}
                  onChange={(title) => set("edits", i, { title })}
                />
              )}
              {edit.doneWhen !== null && (
                <EditField
                  label={t("editDoneWhen")}
                  today={edit.currentDoneWhen}
                  value={edit.doneWhen}
                  max={500}
                  onChange={(doneWhen) => set("edits", i, { doneWhen })}
                />
              )}
              {edit.why && <p className="text-meta pl-6 text-xs">{edit.why}</p>}
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

/** One changed field: what it would become, with what stands today under it. */
function EditField({
  label,
  today,
  value,
  max,
  onChange,
}: {
  label: string;
  today: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("aiAssist");
  return (
    <label className="flex flex-col gap-1 pl-6">
      <span className="text-label text-xs font-medium">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={max}
        className="h-7 text-2sm"
      />
      <span className="text-meta text-xs">
        {today.trim() ? t("today", { text: today }) : t("todayEmpty")}
      </span>
    </label>
  );
}
