/**
 * What a full export contains, and what it deliberately leaves out.
 *
 * The list is written by hand rather than derived from the schema, because
 * "everything in the database" is the wrong answer twice over: it would
 * carry secrets out of the system, and it would silently start including
 * whatever table someone adds next. A new table appears in the export when
 * a person decides it should, which is the same discipline the tenancy
 * checklist asks for.
 *
 * Order matters: it is the order of the tabs in the spreadsheet, and it
 * runs from the things a person recognizes (boards, cards) toward the
 * technical ones (audit trail).
 */

export type ExportTable = {
  /** Database table, from this fixed list and never from user input. */
  table: string;
  /** Tab name in the spreadsheet, and key in the JSON export. */
  sheet: string;
  /** Columns never written out, whatever they contain. */
  redact?: string[];
  /** Column to sort by; falls back to the primary key's insertion order. */
  orderBy?: string;
};

export const EXPORT_TABLES: ExportTable[] = [
  { table: "people", sheet: "Personer", orderBy: "created_at" },
  { table: "boards", sheet: "Tavler", orderBy: "created_at" },
  { table: "columns", sheet: "Kolonner", orderBy: "board_id, sort" },
  // The cards sheet carries a swimlane id, so the lanes have to travel
  // with it or the export hands out a reference to nothing. A team's own
  // lane names are the team's (dogma three), like its themes and areas.
  { table: "swimlanes", sheet: "Svømmebaner", orderBy: "board_id, sort" },
  { table: "backlog_items", sheet: "Epics og features", orderBy: "board_id, number" },
  { table: "cards", sheet: "Kort", orderBy: "board_id, number" },
  { table: "themes", sheet: "Temaer", orderBy: "board_id, sort" },
  { table: "areas", sheet: "Områder", orderBy: "board_id, sort" },
  { table: "backlog_item_themes", sheet: "Item-temaer", orderBy: "item_id" },
  { table: "card_themes", sheet: "Kort-temaer", orderBy: "card_id" },
  { table: "releases", sheet: "Releases", orderBy: "board_id, sort" },
  { table: "sprints", sheet: "Sprints", orderBy: "board_id, number" },
  { table: "comments", sheet: "Kommentarer", orderBy: "created_at" },
  { table: "card_transitions", sheet: "Flytninger", orderBy: "at" },
  { table: "events", sheet: "Hændelser", orderBy: "created_at" },
  // The audit trail travels, minus where the person was sitting. A login
  // row carries the address it came from and the browser it came from
  // (src/core/audit/events.ts), and the export is open to every member:
  // without this, one click hands the whole team a record of when each
  // colleague signed in, from which IP and on which device. That is
  // security telemetry about a person, not work the workspace owns, so
  // dogma three does not reach it — and the rows themselves stay where
  // they are, unedited and answerable to an investigation.
  {
    table: "audit_log",
    sheet: "Revisionsspor",
    redact: ["ip_address", "user_agent"],
    orderBy: "created_at",
  },
];

/**
 * Left out on purpose:
 *
 * - `ai_calls`: a counter for rate limiting, not something a workspace owns.
 * - `workspace_llm_settings`: the model choice, which holds an encrypted
 *   key; a workspace that leaves gets its data, not its secrets.
 * - Everything Better Auth owns (users, sessions, accounts, passkeys, two
 *   factors, rate limits). Sessions and passkeys are credentials, and the
 *   people are exported as members below rather than as auth rows.
 * - `access_requests` and `access_invitations`: they belong to the
 *   installation, not to any workspace, and describe people who are not
 *   users of it. The application role cannot read them anyway.
 * - `audit_log.ip_address` and `audit_log.user_agent`, redacted above: a
 *   colleague's address and device, which is the one kind of personal
 *   data in here that the workspace does not own.
 */
export const MEMBERS_SHEET = "Brugere";
