import { asString, list, present, rec } from "./sanitize-helpers";

/**
 * The boundary between a model and the database. Raw model output goes in;
 * only capped strings, sane numbers and a bounded number of items come
 * out. A model can be confused, or talked into something by text in a
 * card title; neither may reach a row uncut.
 */

export type CardDraft = {
  description: string;
  acceptance: string[];
  checklist: string[];
};

export function sanitizeDraft(raw: unknown): CardDraft | null {
  const r = rec(raw);
  const description = asString(r.description, "", 4000);
  const acceptance = strings(r.acceptance ?? r.acceptanceCriteria, 8, 200);
  const checklist = strings(r.checklist, 12, 160);
  if (!description && acceptance.length === 0 && checklist.length === 0) return null;
  return { description, acceptance, checklist };
}

export type SplitProposal = { title: string; estimate: number | null; note: string };

export function sanitizeSplit(raw: unknown): SplitProposal[] {
  const r = rec(raw);
  return present(
    list(r.cards).map((item) => {
      const title = asString(item.title, "", 160);
      if (!title) return null;
      return {
        title,
        estimate: asPoints(item.estimate),
        note: asString(item.note ?? item.description, "", 600),
      };
    }),
  ).slice(0, 8);
}

export type SprintSummary = { summary: string; highlights: string[]; risks: string[] };

export function sanitizeSummary(raw: unknown): SprintSummary | null {
  const r = rec(raw);
  const summary = asString(r.summary, "", 4000);
  if (!summary) return null;
  return {
    summary,
    highlights: strings(r.highlights, 6, 200),
    risks: strings(r.risks, 6, 200),
  };
}

function strings(v: unknown, max: number, each: number): string[] {
  if (!Array.isArray(v)) return [];
  return present(
    v.map((x) => {
      const s = asString(typeof x === "string" ? x : rec(x).title, "", each);
      return s || null;
    }),
  ).slice(0, max);
}

/** A story-point estimate the board can hold: a small whole number, or nothing. */
export function asPoints(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), 100);
}
