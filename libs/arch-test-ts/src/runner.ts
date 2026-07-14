/**
 * Executes a Rule against the import graph and asserts no violations.
 */
import { assertEquals } from "@std/assert";
import { matcher } from "./globs.ts";
import { buildGraph, listFiles } from "./graph.ts";
import type { Assertion, ExceptionSpec, Rule } from "./types.ts";

export async function runRule(root: URL, rule: Rule): Promise<void> {
  const sourceUrls =
    (await Promise.all(rule.sources.map((dir) => listFilesByGlob(dir, rule.exts, root)))).flat();
  const graph = await buildGraph(uniq(sourceUrls), { root, exts: rule.exts });
  const violations = collectViolations(graph, rule.assertion, rule.exceptions);

  if (rule.assertion.kind === "toOnlyBeImportedBy") {
    // Need a second graph over `within` to check who uses the sources.
    const a = rule.assertion;
    const withinUrls = (await Promise.all(
      a.within.map((dir) => listFilesByGlob(dir, a.withinExts, root)),
    )).flat();
    const userGraph = await buildGraph(uniq(withinUrls), { root, exts: a.withinExts });
    const sourceMatch = matcher(rule.sources);
    const allowedMatch = matcher(a.allowedUsers);
    for (const [file, deps] of userGraph) {
      if (allowedMatch(file)) continue;
      for (const dep of deps) {
        if (!sourceMatch(dep)) continue;
        if (isExcepted(file, dep, rule.exceptions)) continue;
        violations.push(`  ${file}\n    → ${dep}`);
      }
    }
  }

  assertEquals(
    violations,
    [],
    `\n[${rule.name}] boundary violations:\n${violations.join("\n")}`,
  );
}

function collectViolations(
  graph: Map<string, string[]>,
  assertion: Assertion,
  exceptions: ExceptionSpec[],
): string[] {
  const violations: string[] = [];
  if (assertion.kind === "toNotImport") {
    const isForbidden = matcher(assertion.targets);
    for (const [file, deps] of graph) {
      for (const dep of deps) {
        if (!isForbidden(dep)) continue;
        if (isExcepted(file, dep, exceptions)) continue;
        violations.push(`  ${file}\n    → ${dep}`);
      }
    }
  } else if (assertion.kind === "toImport") {
    const isRequired = matcher(assertion.targets);
    for (const [file, deps] of graph) {
      if (deps.some(isRequired)) continue;
      if (exceptions.some((e) => e.from && matcher(e.from)(file))) continue;
      violations.push(`  ${file}\n    (missing required dependency)`);
    }
  } else if (assertion.kind === "toOnlyImport") {
    const isAllowed = matcher(assertion.targets);
    for (const [file, deps] of graph) {
      for (const dep of deps) {
        if (isExternal(dep)) continue;
        if (isAllowed(dep)) continue;
        if (isExcepted(file, dep, exceptions)) continue;
        violations.push(`  ${file}\n    → ${dep}`);
      }
    }
  }
  return violations;
}

/**
 * Externals — anything not resolved to a project-relative path. After graph
 * normalization, project deps look like `src/foo/bar.ts` while externals
 * keep their scheme (`jsr:…`, `npm:…`, `https:…`, unstripped `file://…`).
 */
function isExternal(dep: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(dep);
}

function isExcepted(file: string, dep: string, exceptions: ExceptionSpec[]): boolean {
  return exceptions.some((e) => {
    if (e.from && !matcher(e.from)(file)) return false;
    if (e.to && !matcher(e.to)(dep)) return false;
    return true;
  });
}

/**
 * Resolves a glob (like `src/auth/domain/**`) to a list of file URLs by:
 *   1. computing the longest literal prefix (`src/auth/domain/`)
 *   2. walking that prefix on disk
 *   3. filtering with the full glob matcher
 *
 * For literal file paths (no wildcards), returns just that file.
 */
async function listFilesByGlob(glob: string, exts: string[], root: URL): Promise<string[]> {
  const wildcardIdx = glob.search(/[*{]/);
  if (wildcardIdx === -1) {
    // Literal path
    const url = new URL(glob, root);
    try {
      const stat = await Deno.stat(url);
      if (stat.isFile) return [url.href];
      if (stat.isDirectory) return listFiles(glob, { root, exts });
    } catch {
      return [];
    }
    return [];
  }
  const prefix = glob.slice(0, glob.lastIndexOf("/", wildcardIdx) + 1) || "./";
  const candidates = await listFiles(prefix, { root, exts });
  const match = matcher(glob);
  const rootHref = root.href;
  return candidates.filter((u) => {
    const rel = u.startsWith(rootHref) ? u.slice(rootHref.length) : u;
    return match(rel);
  });
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
