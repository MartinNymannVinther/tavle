"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { TypeIcon } from "@/components/board/type-icon";
import type { BootstrapProposal } from "@/modules/ai/bootstrap";
import { cn } from "@/lib/utils";

/**
 * The proposed starting point as a tree the person owns before it
 * exists: every node can be unticked or retitled. Only what stays
 * ticked is written.
 */

type Node = { on: boolean; title: string };
export type Editable = {
  areas: Array<{ on: boolean; name: string }>;
  themes: Array<{ on: boolean; name: string }>;
  epics: Array<
    Node & {
      doneWhen: string;
      targetQuarter: string | null;
      area: string;
      themes: string[];
      features: Array<Node & { doneWhen: string; cards: Node[] }>;
    }
  >;
};

export function toEditable(proposal: BootstrapProposal): Editable {
  return {
    areas: proposal.areas.map((name) => ({ on: true, name })),
    themes: proposal.themes.map((name) => ({ on: true, name })),
    epics: proposal.epics.map((epic) => ({
      on: true,
      title: epic.title,
      doneWhen: epic.doneWhen,
      targetQuarter: epic.targetQuarter,
      area: epic.area,
      themes: epic.themes,
      features: epic.features.map((feature) => ({
        on: true,
        title: feature.title,
        doneWhen: feature.doneWhen,
        cards: feature.cards.map((card) => ({ on: true, title: card.title })),
      })),
    })),
  };
}

/** What stays ticked, with every kept epic's area kept alongside it (rule 3 needs it). */
export function keepChecked(tree: Editable): BootstrapProposal {
  const epics = tree.epics
    .filter((epic) => epic.on && epic.title.trim())
    .map((epic) => ({
      title: epic.title.trim(),
      doneWhen: epic.doneWhen,
      targetQuarter: epic.targetQuarter,
      area: epic.area,
      themes: epic.themes,
      features: epic.features
        .filter((feature) => feature.on && feature.title.trim())
        .map((feature) => ({
          title: feature.title.trim(),
          doneWhen: feature.doneWhen,
          cards: feature.cards
            .filter((card) => card.on && card.title.trim())
            .map((card) => ({ title: card.title.trim() })),
        })),
    }));
  const areas = tree.areas.filter((a) => a.on).map((a) => a.name);
  for (const epic of epics) {
    if (epic.area && !areas.some((name) => name.toLowerCase() === epic.area.toLowerCase())) {
      areas.push(epic.area);
    }
  }
  return {
    areas: areas.slice(0, 5),
    themes: tree.themes.filter((t) => t.on).map((t) => t.name),
    epics,
  };
}

export function BootstrapReview({
  tree,
  onChange,
}: {
  tree: Editable;
  onChange: (tree: Editable) => void;
}) {
  const t = useTranslations("aiBootstrap");
  const patch = (next: Partial<Editable>) => onChange({ ...tree, ...next });
  const row = "flex items-center gap-2";
  const box = "accent-[var(--primary)]";

  return (
    <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
      {(tree.areas.length > 0 || tree.themes.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["areas", "themes"] as const).map((kind) => (
            <fieldset key={kind} className="flex flex-col gap-1">
              <legend className="text-label mb-1 text-xs font-medium">
                {t(kind === "areas" ? "areas" : "themes")}
              </legend>
              {tree[kind].map((item, i) => (
                <label key={item.name} className={cn(row, "text-sm")}>
                  <input
                    type="checkbox"
                    checked={item.on}
                    onChange={(e) =>
                      patch({
                        [kind]: tree[kind].map((x, j) =>
                          j === i ? { ...x, on: e.target.checked } : x,
                        ),
                      } as Partial<Editable>)
                    }
                    className={box}
                  />
                  {item.name}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {tree.epics.map((epic, ei) => {
          const setEpic = (next: Partial<Editable["epics"][number]>) =>
            patch({ epics: tree.epics.map((x, j) => (j === ei ? { ...x, ...next } : x)) });
          return (
            <div
              key={ei}
              className={cn(
                "border-border flex flex-col gap-1.5 rounded-lg border p-2.5",
                !epic.on && "opacity-50",
              )}
            >
              <div className={row}>
                <input
                  type="checkbox"
                  checked={epic.on}
                  onChange={(e) => setEpic({ on: e.target.checked })}
                  className={box}
                  aria-label={t("keepEpic", { title: epic.title })}
                />
                <TypeIcon type="epic" />
                <Input
                  value={epic.title}
                  onChange={(e) => setEpic({ title: e.target.value })}
                  maxLength={160}
                  className="h-8 flex-1 text-2sm font-medium"
                />
                {epic.targetQuarter && (
                  <span className="text-meta shrink-0 text-xs tabular-nums">
                    {epic.targetQuarter}
                  </span>
                )}
              </div>
              {epic.doneWhen && (
                <p className="text-meta pl-6 text-xs">
                  {t("doneWhen")} {epic.doneWhen}
                </p>
              )}
              {epic.features.map((feature, fi) => {
                const setFeature = (next: Partial<(typeof epic.features)[number]>) =>
                  setEpic({
                    features: epic.features.map((x, j) => (j === fi ? { ...x, ...next } : x)),
                  });
                return (
                  <div
                    key={fi}
                    className={cn("flex flex-col gap-1 pl-6", !feature.on && "opacity-50")}
                  >
                    <div className={row}>
                      <input
                        type="checkbox"
                        checked={feature.on}
                        onChange={(e) => setFeature({ on: e.target.checked })}
                        className={box}
                        aria-label={t("keepFeature", { title: feature.title })}
                      />
                      <TypeIcon type="feature" />
                      <Input
                        value={feature.title}
                        onChange={(e) => setFeature({ title: e.target.value })}
                        maxLength={160}
                        className="h-7 flex-1 text-2sm"
                      />
                    </div>
                    {feature.cards.map((card, ci) => (
                      <div key={ci} className={cn(row, "pl-6", !card.on && "opacity-50")}>
                        <input
                          type="checkbox"
                          checked={card.on}
                          onChange={(e) =>
                            setFeature({
                              cards: feature.cards.map((x, j) =>
                                j === ci ? { ...x, on: e.target.checked } : x,
                              ),
                            })
                          }
                          className={box}
                          aria-label={t("keepCard", { title: card.title })}
                        />
                        <TypeIcon type="card" />
                        <Input
                          value={card.title}
                          onChange={(e) =>
                            setFeature({
                              cards: feature.cards.map((x, j) =>
                                j === ci ? { ...x, title: e.target.value } : x,
                              ),
                            })
                          }
                          maxLength={160}
                          className="h-7 flex-1 text-2sm"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
