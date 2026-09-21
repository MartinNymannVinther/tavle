import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPOSITORY_URL, sourceOffer } from "../../src/core/version";

/**
 * AGPL-3.0 section 13 is not satisfied by a licence file. A program
 * people reach over a network must "prominently offer all users
 * interacting with it remotely ... an opportunity to receive the
 * Corresponding Source", and for a long while Tavle did not: the only
 * github.com link in the whole interface was a deep link to the
 * subprocessor list on the terms page.
 *
 * The offer is now two links built from one function, and both of them
 * are the kind of thing a refactor removes without anyone noticing -
 * a footer line and a card at the bottom of a settings page. So the
 * obligation is pinned here rather than left to a reader: the pages
 * that carry the offer, the repository named in one place, and the
 * copy in both catalogues.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const LANDING = join(ROOT, "src", "app", "[locale]", "page.tsx");
const ABOUT = join(ROOT, "src", "app", "[locale]", "(app)", "settings", "about", "page.tsx");
/** The one file allowed to spell the repository out. */
const VERSION = join(ROOT, "src", "core", "version.ts");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("sourceOffer", () => {
  const base = {
    version: "0.11.3",
    commit: "a1b2c3d",
    dirty: false,
    builtAt: "",
    release: "0.11.3+a1b2c3d",
    migration: "0001",
    migrationCount: 1,
  };

  it("points at the very tree this build was made from", () => {
    expect(sourceOffer(base)).toEqual({
      url: `${REPOSITORY_URL}/tree/a1b2c3d`,
      exact: true,
    });
  });

  it("falls back to the project when the build carries uncommitted changes", () => {
    // The commit would be a promise the running code does not keep.
    expect(sourceOffer({ ...base, dirty: true })).toEqual({ url: REPOSITORY_URL, exact: false });
  });

  it("falls back to the project when no commit was stamped in", () => {
    expect(sourceOffer({ ...base, commit: "unknown" })).toEqual({
      url: REPOSITORY_URL,
      exact: false,
    });
    expect(sourceOffer({ ...base, commit: "" })).toEqual({ url: REPOSITORY_URL, exact: false });
  });
});

describe("the offer the running app makes", () => {
  it("stands on the public landing page, which is what a stranger and the demo meet", () => {
    const landing = read(LANDING);
    expect(landing).toContain("sourceOffer");
    expect(landing).toContain("href={source.url}");
  });

  it("stands on the About page, where the version it offers is named", () => {
    const about = read(ABOUT);
    expect(about).toContain("sourceOffer");
    expect(about).toContain("href={source.url}");
    // The honest case: a dirty build must not be described as a commit.
    expect(about).toContain("source.exact");
    expect(about).toContain("source.inexact");
  });

  it("names the repository in one place and nowhere else in src", () => {
    // The default, which is what an installation that did not fork runs.
    expect(REPOSITORY_URL).toBe("https://github.com/MartinNymannVinther/tavle");
    // And nowhere else, across all of src rather than the two files the
    // offer happens to live in today. A second copy typed somewhere is a
    // copy that keeps pointing here after a fork sets TAVLE_SOURCE_URL —
    // which is the section 13 breach, not the answer to it.
    const strays = readdirSync(join(ROOT, "src"), { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.tsx?$/.test(entry))
      .filter((entry) => {
        const file = join(ROOT, "src", entry);
        return file !== VERSION && read(file).includes("github.com");
      });
    expect(strays).toEqual([]);
  });

  it("offers the same repository the README tells people to clone", () => {
    expect(read(join(ROOT, "README.md"))).toContain(`${REPOSITORY_URL}.git`);
  });

  it("has the copy in both catalogues", () => {
    for (const locale of ["da", "en"] as const) {
      const messages = JSON.parse(read(join(ROOT, "messages", `${locale}.json`))) as {
        app: { about: { source?: Record<string, string> } };
      };
      const source = messages.app.about.source;
      expect(source, locale).toBeTruthy();
      for (const key of ["title", "exact", "inexact", "link"]) {
        expect(source?.[key], `${locale}.${key}`).toBeTruthy();
      }
      // The offer is worth nothing if it does not say which licence asks
      // for it; both halves of the copy carry the name.
      expect(source?.exact, locale).toContain("AGPL-3.0");
      expect(source?.inexact, locale).toContain("AGPL-3.0");
    }
  });
});
