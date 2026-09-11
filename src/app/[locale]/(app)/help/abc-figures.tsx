import type { ReactNode } from "react";

/**
 * Ten small vignettes in the tool's own language of lines: calm strokes,
 * the family's moss green as the accent, everything else a grey. They are
 * decoration, so they are hidden from screen readers and the text next to
 * them carries the whole meaning.
 */

const ACCENT = "var(--primary)";
const LINE = "var(--label)";
const SOFT = "var(--muted)";
const WARN = "var(--destructive)";
const GOOD = "var(--success)";

const card = (x: number, y: number, fill: string, w = 24) => (
  <rect x={x} y={y} width={w} height="10" rx="3" fill={fill} stroke="none" />
);

export const ABC_FIGURES: ReactNode[] = [
  // 1. Make the work visible: three columns, every card on the board.
  <g key="visible" fill="none">
    <rect x="8" y="10" width="30" height="64" rx="5" stroke={LINE} strokeWidth="2" />
    <rect x="45" y="10" width="30" height="64" rx="5" stroke={LINE} strokeWidth="2" />
    <rect x="82" y="10" width="30" height="64" rx="5" stroke={LINE} strokeWidth="2" />
    {card(11, 16, ACCENT)}
    {card(11, 30, ACCENT)}
    {card(11, 44, ACCENT)}
    {card(48, 16, ACCENT)}
    {card(85, 16, GOOD)}
    {card(85, 30, GOOD)}
  </g>,
  // 2. Limit the work in progress: one column full, the extra card waiting.
  <g key="wip" fill="none">
    <rect x="30" y="8" width="60" height="68" rx="6" stroke={WARN} strokeWidth="2.5" />
    <text x="60" y="22" textAnchor="middle" fill={WARN} fontSize="11" fontWeight="600">
      3/3
    </text>
    {card(36, 30, ACCENT, 48)}
    {card(36, 44, ACCENT, 48)}
    {card(36, 58, ACCENT, 48)}
    {card(4, 44, SOFT, 20)}
  </g>,
  // 3. Finish before you start: an arrow from doing into done.
  <g key="finish" fill="none" strokeLinecap="round">
    {card(10, 38, ACCENT, 30)}
    <path d="M46 43 L 74 43" stroke={LINE} strokeWidth="2.5" />
    <path d="M68 37 L 76 43 L 68 49" stroke={LINE} strokeWidth="2.5" />
    {card(82, 38, GOOD, 30)}
    <path d="M88 43 l 5 5 l 9 -10" stroke="var(--card)" strokeWidth="2.5" />
  </g>,
  // 4. Small cards: a big block split into pieces.
  <g key="small" fill="none">
    <rect x="8" y="14" width="104" height="14" rx="5" fill={SOFT} stroke="none" />
    <line x1="52" y1="10" x2="68" y2="32" stroke={WARN} strokeWidth="2.5" strokeLinecap="round" />
    {card(8, 46, ACCENT, 30)}
    {card(45, 46, ACCENT, 30)}
    {card(82, 46, ACCENT, 30)}
    {card(8, 62, ACCENT, 30)}
    {card(45, 62, ACCENT, 30)}
  </g>,
  // 5. One owner per card: a person on the card.
  <g key="owner" fill="none">
    <rect x="18" y="16" width="84" height="52" rx="6" stroke={LINE} strokeWidth="2" />
    <circle cx="82" cy="46" r="9" fill={ACCENT} stroke="none" />
    <path d="M68 66 C 68 54, 96 54, 96 66" fill={ACCENT} stroke="none" />
    <line x1="26" y1="30" x2="70" y2="30" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="26" y1="42" x2="56" y2="42" stroke={SOFT} strokeWidth="2.5" strokeLinecap="round" />
  </g>,
  // 6. Say what done means: a column with a tick on its lid.
  <g key="done" fill="none" strokeLinecap="round">
    <rect x="40" y="18" width="40" height="58" rx="5" stroke={LINE} strokeWidth="2" />
    <circle cx="60" cy="14" r="11" fill={GOOD} stroke="none" />
    <path d="M54 14 l 4 4 l 8 -8" stroke="var(--card)" strokeWidth="2.5" />
    {card(45, 34, GOOD, 30)}
    {card(45, 48, GOOD, 30)}
  </g>,
  // 7. Look at the flow, not the people: a widening band.
  <g key="flow" fill="none">
    <path d="M8 70 C 40 60, 70 40, 112 20 L 112 70 Z" fill={SOFT} stroke="none" />
    <path d="M8 70 C 40 66, 70 56, 112 46 L 112 70 Z" fill={ACCENT} stroke="none" opacity="0.8" />
    <line x1="8" y1="70" x2="112" y2="70" stroke={LINE} strokeWidth="2" />
  </g>,
  // 8. Blocked is a signal: a card with a warning, an arrow to a person.
  <g key="blocked" fill="none" strokeLinecap="round">
    <rect x="10" y="26" width="56" height="32" rx="5" stroke={WARN} strokeWidth="2.5" />
    <line x1="38" y1="34" x2="38" y2="44" stroke={WARN} strokeWidth="3" />
    <circle cx="38" cy="50" r="1.8" fill={WARN} stroke="none" />
    <path d="M70 42 L 90 42" stroke={LINE} strokeWidth="2.5" />
    <path d="M85 37 L 92 42 L 85 47" stroke={LINE} strokeWidth="2.5" />
    <circle cx="104" cy="34" r="7" fill={ACCENT} stroke="none" />
    <path d="M94 56 C 94 46, 114 46, 114 56" fill={ACCENT} stroke="none" />
  </g>,
  // 9. A rhythm: the sprint as repeated arcs on a line.
  <g key="rhythm" fill="none" strokeLinecap="round">
    <line x1="8" y1="60" x2="112" y2="60" stroke={LINE} strokeWidth="2" />
    <path d="M12 60 C 24 20, 40 20, 52 60" stroke={ACCENT} strokeWidth="2.5" />
    <path d="M52 60 C 64 20, 80 20, 92 60" stroke={ACCENT} strokeWidth="2.5" />
    <path
      d="M92 60 C 98 40, 104 30, 112 28"
      stroke={ACCENT}
      strokeWidth="2.5"
      strokeDasharray="1 6"
    />
    <circle cx="12" cy="60" r="3" fill={LINE} stroke="none" />
    <circle cx="52" cy="60" r="3" fill={LINE} stroke="none" />
    <circle cx="92" cy="60" r="3" fill={LINE} stroke="none" />
  </g>,
  // 10. Improve in small steps: a staircase rising to the right.
  <g key="improve" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M10 72 L 10 58 L 36 58 L 36 44 L 62 44 L 62 30 L 88 30 L 88 16 L 112 16"
      stroke={ACCENT}
      strokeWidth="3"
    />
    <circle cx="20" cy="66" r="4" fill={LINE} stroke="none" />
    <circle cx="98" cy="10" r="4" fill={GOOD} stroke="none" />
  </g>,
];
