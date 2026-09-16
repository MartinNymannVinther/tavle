import PptxGenJS from "pptxgenjs";
import type { OrgContext } from "@/core/db/tenant";
import { getBoardFull } from "@/modules/boards/read";
import { roadmap } from "@/modules/boards/structure/roadmap";

/**
 * The roadmap as one 16:9 slide (docs/adr/0028): the epics as bars on
 * the quarter axis, coloured by their first theme, the current quarter
 * banded, the unplanned named in the footer. A deck's page, not a
 * screenshot — the colours are the 2a palette written as hex, because
 * a .pptx cannot read CSS variables.
 */

const PAPER = "F7F5F1";
const INK = "24221E";
const LABEL = "6E6B67";
const HAIRLINE = "DDD8CF";
const BAND = "ECE9E2";

const SWATCH: Record<string, { bar: string; ink: string }> = {
  moss: { bar: "4A6B53", ink: PAPER },
  sage: { bar: "7A9A80", ink: INK },
  clay: { bar: "C08A63", ink: INK },
  rust: { bar: "8C5B3E", ink: PAPER },
  sand: { bar: "C9C2B6", ink: INK },
  stone: { bar: "6E6B67", ink: PAPER },
  ink: { bar: "24221E", ink: PAPER },
  forest: { bar: "2C4A37", ink: PAPER },
};

/** The words the slide carries, resolved by the caller in the reader's language. */
export type PptxLabels = { unplanned: string };

const PAGE = { width: 13.33, height: 7.5 };
const CHART = { left: 3.2, top: 1.55, right: 0.5, rowHeight: 0.52, rowGap: 0.1 };
const MAX_ROWS = 9;

export async function buildRoadmapPptx(
  ctx: OrgContext,
  boardId: string,
  labels: PptxLabels,
): Promise<Buffer | null> {
  const full = await getBoardFull(ctx, boardId);
  if (!full) return null;
  const data = roadmap(full);
  const shown = data.rows.slice(0, MAX_ROWS);
  const width = PAGE.width - CHART.left - CHART.right;
  const cell = width / Math.max(1, data.quarters.length);
  const xOf = (quarter: string) => CHART.left + data.quarters.indexOf(quarter) * cell;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "wide", width: PAGE.width, height: PAGE.height });
  pptx.layout = "wide";
  const slide = pptx.addSlide();
  slide.background = { color: PAPER };

  slide.addText(full.board.name, {
    x: 0.5,
    y: 0.35,
    w: PAGE.width - 1,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: INK,
    fontFace: "Archivo",
  });
  slide.addText(`Roadmap · ${data.current}`, {
    x: 0.5,
    y: 0.92,
    w: 6,
    h: 0.3,
    fontSize: 12,
    color: LABEL,
    fontFace: "Archivo",
  });

  // The current quarter as a quiet band under everything.
  const chartBottom =
    CHART.top + 0.4 + shown.length * (CHART.rowHeight + CHART.rowGap) + CHART.rowGap;
  if (data.quarters.includes(data.current)) {
    slide.addShape("rect", {
      x: xOf(data.current),
      y: CHART.top,
      w: cell,
      h: chartBottom - CHART.top,
      fill: { color: BAND },
      line: { color: BAND },
    });
  }

  // The quarter heads and their hairlines.
  data.quarters.forEach((quarter, index) => {
    const x = CHART.left + index * cell;
    slide.addText(quarter, {
      x,
      y: CHART.top,
      w: cell,
      h: 0.32,
      fontSize: 11,
      color: quarter === data.current ? INK : LABEL,
      bold: quarter === data.current,
      align: "center",
      fontFace: "Archivo",
    });
    slide.addShape("line", {
      x,
      y: CHART.top + 0.36,
      w: 0,
      h: chartBottom - CHART.top - 0.36,
      line: { color: HAIRLINE, width: 0.75 },
    });
  });

  // One row per planned epic: the title on the left, the bar where it runs.
  shown.forEach((row, index) => {
    const y = CHART.top + 0.44 + index * (CHART.rowHeight + CHART.rowGap);
    slide.addText(`${full.board.key}-${row.epic.number}  ${row.epic.title}`, {
      x: 0.5,
      y,
      w: CHART.left - 0.65,
      h: CHART.rowHeight,
      fontSize: 11,
      color: INK,
      fontFace: "Archivo",
      valign: "middle",
      shrinkText: true,
    });
    const swatch = SWATCH[row.theme?.color ?? "moss"] ?? SWATCH.moss!;
    const from = xOf(row.startQuarter);
    const to = xOf(row.endQuarter) + cell;
    slide.addText(row.epic.title, {
      shape: "roundRect",
      rectRadius: 0.08,
      x: from + 0.04,
      y,
      w: Math.max(to - from - 0.08, cell * 0.5),
      h: CHART.rowHeight,
      fill: { color: swatch.bar },
      line: { color: swatch.bar },
      fontSize: 10.5,
      color: swatch.ink,
      fontFace: "Archivo",
      valign: "middle",
      align: "left",
      inset: 0.08,
      shrinkText: true,
    });
  });

  const footnotes: string[] = [];
  if (data.rows.length > shown.length) footnotes.push(`+ ${data.rows.length - shown.length}`);
  if (data.unplanned.length > 0) {
    footnotes.push(
      `${labels.unplanned}: ${data.unplanned
        .slice(0, 4)
        .map((row) => row.epic.title)
        .join(" · ")}${data.unplanned.length > 4 ? ` (+${data.unplanned.length - 4})` : ""}`,
    );
  }
  footnotes.push(`Tavle · ${new Date().toISOString().slice(0, 10)}`);
  slide.addText(footnotes.join("     "), {
    x: 0.5,
    y: PAGE.height - 0.55,
    w: PAGE.width - 1,
    h: 0.3,
    fontSize: 10,
    color: LABEL,
    fontFace: "Archivo",
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
