import type { EnablerType, Priority, ThemeColor } from "@/core/db/schema";

/**
 * The demo's content in both languages. Ordinary work a small team would
 * recognise: a webshop run as a flow, an app built in sprints — each with
 * the structure above the cards, so the backlog, the roadmap and the
 * overview have something to show on the first visit.
 */

export type DemoCard = {
  title: string;
  description?: string;
  column: "backlog" | "todo" | "doing" | "done";
  estimate?: number;
  priority?: Priority;
  dueOffset?: number;
  checklist?: string[];
  blocked?: string;
  /** The feature the card is part of, by title; otherwise the area it sits in. */
  feature?: string;
  area?: string;
  bug?: boolean;
  enabler?: EnablerType;
};

export type DemoFeature = { title: string; doneWhen: string; closed?: boolean };

export type DemoEpic = {
  title: string;
  doneWhen: string;
  area: string;
  themes: string[];
  enabler?: EnablerType;
  /** Quarters from the current one; absent means no target, which the roadmap lists as unplanned. */
  quarterOffset?: number;
  /** Days the epic is made to look older than it is, so one shows the review mark. */
  agedDays?: number;
  closed?: boolean;
  features: DemoFeature[];
};

export type DemoStructure = {
  areas: string[];
  themes: Array<{ name: string; color: ThemeColor }>;
  epics: DemoEpic[];
};

export type SprintCard = {
  title: string;
  estimate: number;
  feature?: string;
  area?: string;
  enabler?: EnablerType;
  bug?: boolean;
};

export type DemoWords = {
  kanban: {
    name: string;
    key: string;
    description: string;
    structure: DemoStructure;
    cards: DemoCard[];
    comment: string;
  };
  scrum: {
    name: string;
    key: string;
    description: string;
    structure: DemoStructure;
    pastSprints: Array<{
      name: string;
      goal: string;
      cards: Array<SprintCard & { done: boolean }>;
    }>;
    activeSprint: {
      name: string;
      goal: string;
      cards: Array<
        SprintCard & { state: "todo" | "doing" | "done"; priority?: Priority; mine?: boolean }
      >;
    };
    backlog: Array<Omit<SprintCard, "estimate"> & { estimate: number | null }>;
    plannedSprint: { name: string; goal: string };
  };
};

export { DEMO_DA } from "./words-da";
export { DEMO_EN } from "./words-en";
