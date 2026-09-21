import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import da from "../../messages/da.json";
import en from "../../messages/en.json";

/**
 * The pieces of /terms that are not prose but law.
 *
 * The page is the only privacy information a user of tavle.haij.dk ever
 * sees, so it is the installation's Article 13 notice whether or not it
 * is called one. Article 13 asks it to name the controller, say on what
 * basis each purpose rests, list the rights and name the supervisory
 * authority — and none of that is visible to the type system, to lint
 * or to any other test here. A later edit that tightens the wording can
 * drop one of them without a single thing going red, which is why they
 * are pinned by hand, the way tests/meta/header-width.test.ts pins the
 * two layout rules a phone depends on.
 *
 * What this cannot check is whether the notice is *true*. Retention and
 * the AI section are written from the code, and
 * docs/processing-record.md says where each claim comes from; keeping
 * them honest is a reading job, not an assertion.
 */

type Catalogue = typeof da;

const CATALOGUES: Array<[string, Catalogue]> = [
  ["da", da],
  ["en", en as Catalogue],
];

/** The repository's first commit. Nothing in it can have been written before. */
const REPOSITORY_BEGAN = Date.UTC(2026, 8, 11);

const MONTHS: Record<string, number> = {
  januar: 0,
  january: 0,
  februar: 1,
  february: 1,
  marts: 2,
  march: 2,
  april: 3,
  maj: 4,
  may: 4,
  juni: 5,
  june: 5,
  juli: 6,
  july: 6,
  august: 7,
  september: 8,
  oktober: 9,
  october: 9,
  november: 10,
  december: 11,
};

/** The date out of "Senest opdateret 21. september 2026." and its English twin. */
function updatedAt(sentence: string): number {
  const match = sentence.match(/(\d{1,2})\.?\s+([A-Za-zæøåÆØÅ]+)\s+(\d{4})/);
  if (!match) throw new Error(`no date in "${sentence}"`);
  const [, day, month, year] = match;
  const index = MONTHS[month!.toLowerCase()];
  if (index === undefined) throw new Error(`unknown month "${month}"`);
  return Date.UTC(Number(year), index, Number(day));
}

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the privacy notice carries what makes it lawful", () => {
  it.each(CATALOGUES)("%s names the controller and how to reach it", (_locale, messages) => {
    const who = messages.terms.who.body;
    expect(who).toContain("Vinther Consulting");
    expect(who).toContain("martin@vintherconsulting.dk");
    // Both roles, because only one of them would be a half-truth: we are
    // the controller for the account and the processor for the board.
    expect(who).toMatch(/dataansvarlige?|controller/i);
    expect(who).toMatch(/databehandler|processor/i);
  });

  it.each(CATALOGUES)("%s gives a legal basis for each purpose", (_locale, messages) => {
    const basis = messages.terms.basis.body;
    // Performance of the contract and legitimate interest are the two
    // the code actually runs on; consent is claimed nowhere, and must
    // not start being claimed without something to consent to.
    expect(basis).toMatch(/6\(1\)\(b\)|litra b/);
    expect(basis).toMatch(/6\(1\)\(f\)|litra f/);
  });

  it.each(CATALOGUES)("%s lists every right a data subject has", (_locale, messages) => {
    const rights = messages.terms.rights.list;
    for (const right of [
      "access",
      "rectification",
      "erasure",
      "portability",
      "restriction",
      "objection",
    ] as const) {
      expect(rights[right]?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it.each(CATALOGUES)("%s names Datatilsynet as the supervisory authority", (_locale, messages) => {
    expect(messages.terms.complaint.body).toContain("Datatilsynet");
  });

  it.each(CATALOGUES)("%s says the placement assist goes out on its own", (_locale, messages) => {
    // The one model call no button starts (src/components/board/quick-add.tsx),
    // and the one that carries other cards than the one at hand. A notice
    // that describes only the button-pressed eight under-describes what
    // leaves the machine.
    expect(messages.terms.ai.body).toContain("800");
  });

  it("is dated, in both catalogues, no earlier than the repository", () => {
    const dates = CATALOGUES.map(([, messages]) => updatedAt(messages.terms.updated));
    expect(new Set(dates).size, "da and en should carry the same date").toBe(1);
    expect(dates[0]!).toBeGreaterThanOrEqual(REPOSITORY_BEGAN);
  });
});

describe("the page and the form still show it", () => {
  it("renders every section the catalogues carry, and no section without copy", async () => {
    const source = await read("src/app/[locale]/terms/page.tsx");
    const listed = source.match(/const SECTIONS = \[([\s\S]*?)\] as const;/)?.[1];
    expect(listed, "the page should still lay its sections out in one list").toBeDefined();
    const sections = [...listed!.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]!);
    for (const section of ["who", "basis", "retention", "rights", "complaint"]) {
      expect(sections, `${section} should be on the page`).toContain(section);
    }
    for (const [, messages] of CATALOGUES) {
      const terms = messages.terms as unknown as Record<string, { title: string; body: string }>;
      for (const section of sections) {
        expect(terms[section]?.title?.length ?? 0).toBeGreaterThan(0);
        expect(terms[section]?.body?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("links the notice from the point of collection", async () => {
    // Article 13 wants the information where the data is handed over,
    // and the application form is where a stranger hands over a name, an
    // address and free text. The landing page's footer is not that place.
    const source = await read("src/app/[locale]/(auth)/register/access-request-form.tsx");
    expect(source).toMatch(/href="\/terms"/);
    expect(source).toContain('t("privacyLink")');
  });

  it.each(CATALOGUES)("%s admits the IP address on the application form", (_locale, messages) => {
    // submitAccessRequest() writes ipAddress and userAgent beside the
    // three fields the sentence used to stop at.
    expect(messages.auth.apply.privacy).toMatch(/IP-adresse|IP address/);
  });

  it.each(CATALOGUES)("%s promises the number of backup days the script keeps", async (_l, m) => {
    // The one retention figure the notice states as a bare number that no
    // code can interpolate: the backup script is shell, so the page and
    // the script agree only for as long as somebody keeps them agreeing.
    // They were reconciled once already — the promise said thirty days
    // while only one end of the pipeline pruned at all — and nothing has
    // stopped it drifting back since.
    const script = await read("scripts/backup-tavle.sh");
    const days = script.match(/KEEP_DAYS="\$\{KEEP_DAYS:-(\d+)\}"/)?.[1];
    expect(days, "the backup script should still carry a default").toBeDefined();
    expect(
      m.terms.retention.rows.backups,
      `the notice should say ${days} days, the number the script prunes at`,
    ).toContain(days!);
  });

  it.each(CATALOGUES)("%s tells the demo's hours from the constant, not by hand", (_l, m) => {
    // DEMO_TTL_HOURS reaches the page as {hours}; a literal here would
    // be a number that stops being true the day the constant moves.
    expect(m.terms.retention.rows.demo).toContain("{hours");
    expect(m.terms.demo.body).not.toMatch(/\b24\b/);
  });
});
