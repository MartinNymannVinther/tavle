import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A server action is a public HTTP endpoint wearing a function's clothes.
 * Nothing about the language says so: an exported async function in a
 * "use server" file is callable by anyone who can reach the origin, and
 * one that forgets to resolve the caller's session is an unauthenticated
 * write that lint, typecheck and the whole suite call green.
 *
 * So the rule the constitution states in prose — every server action
 * resolves the caller's session and workspace first — is held here, the
 * way tests/rls holds the tenancy rules: by reading what is actually in
 * the repository and making the exceptions argue for themselves. A
 * nineteenth actions file that reaches past `action()` fails this test,
 * and the only way to pass it is to name the function below and say why.
 *
 * Checked, in order of how badly it goes wrong when it is not: that every
 * "use server" file is an `actions*.ts` file, so the list of files read
 * here is the list that exists; that every exported action reaches a
 * guard — the helper in src/modules/boards/action-helpers.ts, or
 * `requireOrgContext()` itself, directly or one call away in the same
 * file; that the guard's empty answer is refused, since a result nobody
 * looks at is not a guard; and that the exemptions below are all still
 * real functions, so a name left behind cannot excuse a later one.
 */

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The guards. `action()` and `withWorkspace()` both begin with
 * `requireOrgContext()` and answer "unauthorized" when it comes back
 * empty; `action()` also validates the payload, opens the transaction
 * with the tenant context set, and checks the role when the work is an
 * owner's or an admin's.
 */
const GUARDS = ["action", "withWorkspace", "requireOrgContext"];

type Exemption = {
  /** Repo-relative file, and the exported function in it. */
  file: string;
  name: string;
  /** The guard it stands on instead, or null when it is public by design. */
  instead: string | null;
  why: string;
};

/**
 * The actions that cannot resolve a workspace, because at the moment they
 * run there is not one yet. Each is here with the guard it stands on
 * instead; adding a name is an argument somebody has to make in a pull
 * request, which is the whole point of the list.
 */
const EXEMPT: Exemption[] = [
  {
    file: "src/core/auth/actions.ts",
    name: "registerAction",
    instead: null,
    why: "Registration: there is no session to resolve. The gate is SIGNUP plus the sign-up hook in src/core/auth/auth.ts, which refuses an uninvited address.",
  },
  {
    file: "src/core/access/actions.ts",
    name: "requestAccessAction",
    instead: null,
    why: "Admission by application (docs/adr/0008): a stranger asks for access. Rate limited per address per hour and honeypotted in submitAccessRequest.",
  },
  {
    file: "src/core/access/actions.ts",
    name: "approveAccessRequestAction",
    instead: "ownerUserId",
    why: "Installation work, not workspace work: the platform owner answers the queue. ownerUserId() resolves the session and checks the platform role.",
  },
  {
    file: "src/core/access/actions.ts",
    name: "declineAccessRequestAction",
    instead: "ownerUserId",
    why: "As approve: the platform owner, resolved from the session, and a generic failure to everyone else.",
  },
  {
    file: "src/core/access/actions.ts",
    name: "createInvitationAction",
    instead: "ownerUserId",
    why: "The platform owner invites a stranger into a workspace that does not exist yet, so there is no org context to stand in.",
  },
  {
    file: "src/core/team/actions.ts",
    name: "acceptInvitationAction",
    instead: "getSession",
    why: "The caller is signed in but not yet a member of the workspace they are joining; requireOrgContext would refuse the very thing being accepted.",
  },
  {
    file: "src/core/team/actions.ts",
    name: "joinRegisterAction",
    instead: null,
    why: "Registration through a workspace invitation (docs/adr/0008): no session yet. The invitation id is single-purpose, bound to one address and expiring, and registerInvited verifies it.",
  },
];

type SourceFile = { file: string; text: string; ast: ts.SourceFile };

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

const rel = (file: string) => path.relative(ROOT, file);

const isActionsFile = (file: string) => /(^|\/)actions[\w-]*\.ts$/.test(rel(file));

async function read(file: string): Promise<SourceFile> {
  const text = await readFile(file, "utf8");
  return { file, text, ast: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true) };
}

const sources = await Promise.all((await walk(SRC)).map(read));
const actionFiles = sources.filter((source) => isActionsFile(source.file));

const exported = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

type Fn = { name: string; node: ts.Node; async: boolean };

/** Every function in the file by name — exported or not, since a guard may sit one call away. */
function functions(ast: ts.SourceFile): Map<string, Fn> {
  const found = new Map<string, Fn>();
  const add = (name: string, node: ts.Node, modifiers: readonly ts.ModifierLike[] | undefined) => {
    found.set(name, {
      name,
      node,
      async: (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    });
  };
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      add(statement.name.text, statement, ts.getModifiers(statement));
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (!init || !ts.isIdentifier(declaration.name)) continue;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          add(declaration.name.text, statement, ts.getModifiers(init));
        }
      }
    }
  }
  return found;
}

/** Exported functions, and anything else exported that carries a value. */
function exportedValues(ast: ts.SourceFile): { functions: Fn[]; others: string[] } {
  const all = functions(ast);
  const fns: Fn[] = [];
  const others: string[] = [];
  for (const statement of ast.statements) {
    // `export { a } from "./b"` carries no export *modifier* — the
    // statement kind is the export — so it slips past the check below and
    // would be a re-exported action nothing here ever looked at. Named
    // here so the shape test refuses it and somebody has to write the
    // action where it can be read.
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      others.push(statement.getText().split("\n")[0]!);
      continue;
    }
    if (!exported(statement)) continue;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      fns.push(all.get(statement.name.text)!);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const fn = all.get(declaration.name.text);
        if (fn) fns.push(fn);
        else others.push(declaration.name.text);
      }
      continue;
    }
    if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
    others.push(statement.getText().split("\n")[0]!);
  }
  return { functions: fns, others };
}

/** The names a body calls, ignoring `something.name` where the name is a property. */
function calls(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isIdentifier(child)) {
      const parent = child.parent;
      const isProperty =
        (ts.isPropertyAccessExpression(parent) && parent.name === child) ||
        (ts.isPropertyAssignment(parent) && parent.name === child);
      if (!isProperty) names.add(child.text);
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return names;
}

/** Does this function reach one of `targets`, itself or through a helper in the same file? */
function reaches(
  fn: Fn,
  targets: string[],
  all: Map<string, Fn>,
  seen = new Set<string>(),
): boolean {
  if (seen.has(fn.name)) return false;
  seen.add(fn.name);
  const named = calls(fn.node);
  if (targets.some((target) => named.has(target))) return true;
  for (const name of named) {
    const local = all.get(name);
    if (local && reaches(local, targets, all, seen)) return true;
  }
  return false;
}

describe("every server action is guarded", () => {
  it("keeps every 'use server' directive in an actions file", () => {
    // The file name is how this test finds its subjects. A server action
    // declared somewhere else — a file, or a single function body — would
    // be a public endpoint nothing below reads.
    expect(actionFiles.length).toBeGreaterThan(10);
    const stray = sources
      .filter((source) => !isActionsFile(source.file))
      .filter((source) => /["']use server["']/.test(source.text))
      .map((source) => rel(source.file));
    expect(stray).toEqual([]);
  });

  it("declares 'use server' at the top of every actions file", () => {
    const missing = actionFiles
      .filter(
        (source) => !/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(source.text),
      )
      .map((source) => rel(source.file));
    expect(missing).toEqual([]);
  });

  it("exports nothing from an actions file but async functions and types", () => {
    const wrong: string[] = [];
    for (const source of actionFiles) {
      const { functions: fns, others } = exportedValues(source.ast);
      for (const name of others) wrong.push(`${rel(source.file)}: ${name} is not a function`);
      for (const fn of fns) {
        if (!fn.async) wrong.push(`${rel(source.file)}: ${fn.name} is not async`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("reaches the action helper or requireOrgContext from every exported action", () => {
    const unguarded: string[] = [];
    for (const source of actionFiles) {
      const all = functions(source.ast);
      for (const fn of exportedValues(source.ast).functions) {
        const exemption = EXEMPT.find((e) => e.file === rel(source.file) && e.name === fn.name);
        if (exemption) continue;
        if (!reaches(fn, GUARDS, all)) unguarded.push(`${rel(source.file)}: ${fn.name}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("refuses when the guard comes back empty", () => {
    // `const ctx = await requireOrgContext()` with no `if (!ctx) return`
    // under it type-checks and then runs the action for a stranger.
    //
    // Asked of each function's own text rather than the file's. Over the
    // file, one action that does check excuses every action that does
    // not: the same `ctx` is the commonest name in the codebase, so the
    // second action in a file would inherit the first one's guard and
    // this test would go on passing while an unauthenticated write
    // shipped.
    const ignored: string[] = [];
    for (const source of actionFiles) {
      for (const fn of exportedValues(source.ast).functions) {
        const body = fn.node.getText();
        for (const match of body.matchAll(/const (\w+) = await requireOrgContext\(\)/g)) {
          const name = match[1]!;
          if (!new RegExp(`if \\(!${name}\\)\\s*return`).test(body)) {
            ignored.push(`${rel(source.file)}: ${fn.name} ignores ${name}`);
          }
        }
      }
    }
    expect(ignored).toEqual([]);
  });

  it("holds the exempted actions to the guard they named instead", () => {
    const wrong: string[] = [];
    for (const exemption of EXEMPT) {
      const source = actionFiles.find((s) => rel(s.file) === exemption.file);
      if (!source) {
        wrong.push(`${exemption.file} is gone; remove ${exemption.name} from EXEMPT`);
        continue;
      }
      const all = functions(source.ast);
      const fn = exportedValues(source.ast).functions.find((f) => f.name === exemption.name);
      if (!fn) {
        // A name left behind after its action is gone would sit here
        // quietly excusing whatever is written next under the same name.
        wrong.push(`${exemption.file}: ${exemption.name} no longer exists`);
        continue;
      }
      if (exemption.instead && !reaches(fn, [exemption.instead], all)) {
        wrong.push(`${exemption.file}: ${exemption.name} no longer uses ${exemption.instead}`);
      }
      expect(exemption.why.length, `${exemption.name} needs a reason`).toBeGreaterThan(40);
    }
    expect(wrong).toEqual([]);
  });
});
