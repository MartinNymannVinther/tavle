/**
 * Which Tavle is running.
 *
 * The values come from `env` in next.config.ts, which means they are
 * inlined into the bundle when the app is built. That is deliberate: a
 * running container has no git checkout and no package.json to read, and a
 * version the app has to look up at runtime is a version that can be wrong.
 *
 * Written as literal `process.env.X` reads because that is what Next
 * replaces at build time; destructuring or dynamic lookup would leave them
 * undefined in production. The fallbacks are what tests and any other
 * runtime outside a Next build see.
 */

export type BuildInfo = {
  /** Semver from package.json, raised by hand when a step is worth naming. */
  version: string;
  /** Short commit of the code that was built, or "unknown". */
  commit: string;
  /** The build read a working tree with uncommitted changes. Dev only. */
  dirty: boolean;
  /** ISO timestamp of the build, or of dev-server start. */
  builtAt: string;
  /** What the app calls itself: "0.1.0+a1b2c3d". */
  release: string;
  /** Last migration in the checked-in journal the build was made from. */
  migration: string;
  /** How many migrations that journal holds. */
  migrationCount: number;
};

export function formatRelease(version: string, commit: string): string {
  return commit && commit !== "unknown" ? `${version}+${commit}` : version;
}

const version = process.env.TAVLE_VERSION || "0.0.0";
const commit = process.env.TAVLE_COMMIT || "unknown";

export const buildInfo: BuildInfo = {
  version,
  commit,
  dirty: process.env.TAVLE_DIRTY === "1",
  builtAt: process.env.TAVLE_BUILT_AT || "",
  release: formatRelease(version, commit),
  migration: process.env.TAVLE_MIGRATION || "unknown",
  migrationCount: Number(process.env.TAVLE_MIGRATION_COUNT || "0"),
};

/**
 * The one place the repository is named. Everything that offers the
 * source builds its link from here, so moving the repository is one edit
 * rather than a search.
 *
 * An installation that changed the code is running its own version, and
 * section 13 asks it to offer *that* — pointing a modified Tavle's users
 * upstream would offer them code nobody is running, which is the breach
 * rather than the answer. So the URL is a build-time setting with this
 * repository as its default: fork, set `TAVLE_SOURCE_URL`, and the offer
 * follows the fork. Left unset it names the project it came from, which
 * is correct for the overwhelmingly common case of running it unchanged.
 */
export const REPOSITORY_URL =
  process.env.TAVLE_SOURCE_URL || "https://github.com/MartinNymannVinther/tavle";

export type SourceOffer = {
  /** Where to send a person who wants the code. */
  url: string;
  /** The url is the very code answering here, commit for commit. */
  exact: boolean;
};

/**
 * What the app offers its users under AGPL-3.0 section 13: an
 * opportunity to receive the Corresponding Source of the version they
 * are interacting with. The build already stamps in the commit, so the
 * offer can be that precise - `/tree/<commit>` is the tree this
 * container was built from, not merely the project it came from.
 *
 * Two cases where it cannot be: a build made outside a git checkout
 * knows no commit, and a build made from a working tree with
 * uncommitted changes is running code that is not in the repository at
 * all. Both are answered by pointing at the project and saying so,
 * because a commit link that is not what is running is a worse answer
 * than an honest one.
 */
export function sourceOffer(info: BuildInfo = buildInfo): SourceOffer {
  const exact = info.commit !== "" && info.commit !== "unknown" && !info.dirty;
  return { url: exact ? `${REPOSITORY_URL}/tree/${info.commit}` : REPOSITORY_URL, exact };
}
