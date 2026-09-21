import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/wordmark";
import { Link } from "@/i18n/navigation";
import { demoEnabled, DEMO_TTL_HOURS } from "@/modules/demo/service";
import { REPOSITORY_URL } from "@/core/version";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("title") };
}

const SECTIONS = [
  "what",
  "who",
  "account",
  "basis",
  "retention",
  "yourData",
  "ai",
  "shareLinks",
  "leaving",
  "rights",
  "complaint",
  "availability",
  "license",
] as const;

/** The two sections whose body is followed by a list rather than prose. */
const RIGHTS = [
  "access",
  "rectification",
  "erasure",
  "portability",
  "restriction",
  "objection",
] as const;

/**
 * What is kept and for how long, in the order a person asks. The demo row
 * is only there when the installation runs demos at all, for the same
 * reason its own section is: a retention period for something that does
 * not exist here would be a period nobody could check.
 */
const RETENTION_ROWS = ["account", "workspace", "audit", "ai", "requests", "backups"] as const;
const RETENTION_ROWS_WITH_DEMO = [...RETENTION_ROWS, "demo"] as const;

/** The repository files the page points at, in the order they are named. */
const DOCUMENTS = [
  { note: "subprocessorsNote", file: "docs/subprocessors.md" },
  { note: "dpaNote", file: "docs/data-processing-agreement.md" },
  { note: "recordNote", file: "docs/processing-record.md" },
] as const;

// Built from the one place the repository is named, so a fork that sets
// TAVLE_SOURCE_URL points these at its own documents rather than at this
// project's (src/core/version.ts).
const REPO_BLOB = `${REPOSITORY_URL}/blob/main/`;

/**
 * Terms and privacy on one page, in plain language. Two pages would be
 * two pages nobody reads; the dogmas make most of this short, because
 * "your data, always" and "EU or self-hosted" are the answer to nearly
 * every question a person has here.
 *
 * It is also the Article 13 notice, which is why the sections about who
 * we are, what we may do, how long we keep it and what you can demand
 * are not optional prose: a person hands over a name and an address at
 * /register, and this is where they are told what becomes of them. The
 * retention section says out loud where nothing expires today. An
 * invented period would read better and be a lie.
 */
export default async function TermsPage() {
  const t = await getTranslations("terms");
  const locale = await getLocale();

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/">
          <Wordmark className="text-xl" />
        </Link>
        <Link href="/" className="text-meta hover:text-foreground text-sm">
          {t("back")}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <p className="text-meta mt-2 text-sm">{t("updated")}</p>
        <p className="mt-6 text-reading leading-relaxed">{t("intro")}</p>

        {SECTIONS.map((key) => (
          <section key={key}>
            <h2 className="font-heading mt-8 text-lg font-semibold">{t(`${key}.title`)}</h2>
            <p className="mt-1.5 text-reading leading-relaxed">{t(`${key}.body`)}</p>
            {key === "retention" && (
              <ul className="mt-3 space-y-2">
                {(demoEnabled() ? RETENTION_ROWS_WITH_DEMO : RETENTION_ROWS).map((row) => (
                  <li
                    key={row}
                    className="border-border border-t pt-2 text-reading leading-relaxed"
                  >
                    {t(`retention.rows.${row}`, { hours: DEMO_TTL_HOURS })}
                  </li>
                ))}
              </ul>
            )}
            {key === "rights" && (
              <ul className="mt-3 space-y-2">
                {RIGHTS.map((right) => (
                  <li
                    key={right}
                    className="border-border border-t pt-2 text-reading leading-relaxed"
                  >
                    {t(`rights.list.${right}`)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {demoEnabled() && (
          <section>
            <h2 className="font-heading mt-8 text-lg font-semibold">{t("demo.title")}</h2>
            <p className="mt-1.5 text-reading leading-relaxed">
              {t("demo.body", { hours: DEMO_TTL_HOURS })}
            </p>
          </section>
        )}

        <section>
          <h2 className="font-heading mt-8 text-lg font-semibold">{t("contact.title")}</h2>
          <p className="mt-1.5 text-reading leading-relaxed">{t("contact.body")}</p>
        </section>

        {DOCUMENTS.map(({ note, file }, index) => (
          <p
            key={note}
            className={index === 0 ? "text-meta mt-10 text-sm" : "text-meta mt-2 text-sm"}
          >
            {t(note)}{" "}
            <a
              href={`${REPO_BLOB}${file}`}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {file}
            </a>
            .
          </p>
        ))}
        <p className="text-meta mt-2 text-sm">
          <Link
            href="/"
            locale={locale === "da" ? "en" : "da"}
            className="underline-offset-4 hover:underline"
          >
            {t("language")}
          </Link>
        </p>
      </main>
    </div>
  );
}
