/**
 * Import graph resolution. Wraps `@deno/graph` and normalizes paths to
 * project-relative form so glob patterns can match cleanly.
 */
import { createGraph } from "@deno/graph";
import { walk } from "@std/fs/walk";
import { fromFileUrl, toFileUrl } from "@std/path";

export type Graph = Map<string, string[]>;

export type LoadOptions = {
  root: URL;
  exts?: string[];
};

async function makeResolver(root: URL) {
  const raw = await Deno.readTextFile(new URL("deno.json", root));
  const { imports } = JSON.parse(raw) as { imports: Record<string, string> };

  return (specifier: string, referrer: string): string => {
    for (const [alias, target] of Object.entries(imports)) {
      if (alias.endsWith("/") && specifier.startsWith(alias)) {
        return new URL(target + specifier.slice(alias.length), root).href;
      }
    }
    if (specifier.startsWith(".")) {
      return new URL(specifier, referrer).href;
    }
    return specifier;
  };
}

async function loadModule(specifier: string) {
  if (!specifier.startsWith("file://")) {
    return { kind: "external" as const, specifier };
  }
  try {
    const content = await Deno.readTextFile(fromFileUrl(specifier));
    return { kind: "module" as const, specifier, content };
  } catch {
    return undefined;
  }
}

/** List every file under `dir` (relative to `root`) matching the given extensions. */
export async function listFiles(
  dir: string,
  options: LoadOptions,
): Promise<string[]> {
  const exts = options.exts ?? [".ts"];
  const abs = fromFileUrl(new URL(dir, options.root));
  const result: string[] = [];
  try {
    for await (const entry of walk(abs, { exts, includeDirs: false })) {
      result.push(toFileUrl(entry.path).href);
    }
  } catch {
    /* directory does not exist — return empty */
  }
  return result;
}

/**
 * Resolve direct imports of every file in `urls`. Returns a graph keyed by
 * project-relative paths (e.g. `src/auth/domain/models/session.ts`), with
 * deps also normalized to relative paths when they fall under `root`.
 * External deps (jsr:, npm:, etc.) are kept verbatim.
 */
export async function buildGraph(urls: string[], options: LoadOptions): Promise<Graph> {
  if (urls.length === 0) return new Map();
  const resolve = await makeResolver(options.root);
  const graph = await createGraph(urls, { resolve, load: loadModule });
  const out: Graph = new Map();
  const rootHref = options.root.href;
  for (const mod of graph.modules) {
    if (!urls.includes(mod.specifier)) continue;
    const key = mod.specifier.startsWith(rootHref)
      ? mod.specifier.slice(rootHref.length)
      : mod.specifier;
    const deps = (mod.dependencies ?? [])
      .flatMap((d) => [d.code?.specifier, d.type?.specifier])
      .filter((s): s is string => Boolean(s))
      .map((s) => s.startsWith(rootHref) ? s.slice(rootHref.length) : s);
    out.set(key, deps);
  }
  return out;
}
