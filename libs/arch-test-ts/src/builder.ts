/**
 * Fluent builder — Pest-inspired, single-method style.
 *
 *   arch("rule name")
 *     .expect("src/auth/**")
 *     .toNotImport("src/cluster/**")
 *     .ignoring({ from: "src/auth/inbound/policies/**", to: "src/*\/domain/events/**" });
 *
 *   arch("auth — isolated")
 *     .expect("src/auth/**")
 *     .toOnlyImport(["src/auth/**", "src/shared/**"]);
 *
 *   arch("internal — only used by router")
 *     .expect("src/internal/**")
 *     .toOnlyBeImportedBy("cli/ui/router.tsx", { within: "cli/ui/" });
 *
 * Each `arch(name).expect(...)...assertion()` chain registers exactly one
 * `it()`. The assertion call is what registers the test; subsequent
 * `.ignoring()` calls mutate the rule before its deferred execution.
 */
import { it } from "@std/testing/bdd";
import { discover as discoverImpl, type DiscoverOptions } from "./discover.ts";
import { runRule } from "./runner.ts";
import type { Assertion, Exception, ExceptionSpec, PathGlob, PathGlobs, Rule } from "./types.ts";

const DEFAULT_EXTS = [".ts", ".tsx"];

let globalRoot: URL | null = null;
let globalExts: string[] = DEFAULT_EXTS;

export type ArchOptions = { root?: URL; exts?: string[] };

export function configure(options: ArchOptions = {}): void {
  if (options.root) globalRoot = options.root;
  if (options.exts) globalExts = options.exts;
}

export class ArchBuilder {
  private sources: PathGlob[] = [];
  private rule: Rule | null = null;

  constructor(private readonly name: string) {}

  expect(source: PathGlobs): this {
    this.sources = arr(source);
    return this;
  }

  toImport(target: PathGlobs): this {
    this.register({ kind: "toImport", targets: arr(target) });
    return this;
  }

  toNotImport(target: PathGlobs): this {
    this.register({ kind: "toNotImport", targets: arr(target) });
    return this;
  }

  toOnlyImport(targets: PathGlobs): this {
    this.register({ kind: "toOnlyImport", targets: arr(targets) });
    return this;
  }

  toOnlyBeImportedBy(
    allowedUsers: PathGlobs,
    options: { within?: PathGlobs; withinExts?: string[] } = {},
  ): this {
    this.register({
      kind: "toOnlyBeImportedBy",
      allowedUsers: arr(allowedUsers),
      within: arr(options.within ?? ["cli/", "src/"]),
      withinExts: options.withinExts ?? globalExts,
    });
    return this;
  }

  ignoring(spec: Exception | readonly Exception[]): this {
    if (!this.rule) {
      throw new Error(`arch("${this.name}").ignoring() must follow an assertion`);
    }
    const list = toExceptionList(spec);
    this.rule.exceptions.push(...list.map(normalizeException));
    return this;
  }

  private register(assertion: Assertion): void {
    if (this.rule) {
      throw new Error(
        `arch("${this.name}") already has an assertion — call arch() again for a new rule`,
      );
    }
    if (!globalRoot) {
      throw new Error(
        "arch is not configured — call arch.configure({ root: new URL('./', import.meta.url) }) once before declaring rules",
      );
    }
    this.rule = {
      name: this.name,
      sources: this.sources,
      exts: globalExts,
      assertion,
      exceptions: [],
    };
    const rule = this.rule;
    const root = globalRoot;
    it(this.name, () => runRule(root, rule));
  }
}

export function arch(name: string): ArchBuilder {
  return new ArchBuilder(name);
}

export function discover(options: DiscoverOptions): Promise<string[]> {
  if (!globalRoot) {
    throw new Error("arch is not configured — call arch.configure({ root }) before discover()");
  }
  return discoverImpl(globalRoot, options);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function toExceptionList(spec: Exception | readonly Exception[]): Exception[] {
  if (Array.isArray(spec)) {
    const allStrings = spec.length > 0 && spec.every((e) => typeof e === "string");
    if (allStrings) return [spec as readonly string[] as Exception];
    return spec as Exception[];
  }
  return [spec as Exception];
}

function normalizeException(e: Exception): ExceptionSpec {
  if (typeof e === "string") return { from: [e] };
  if (Array.isArray(e)) return { from: [...(e as readonly string[])] };
  const obj = e as { from?: PathGlobs; to?: PathGlobs; reason?: string };
  return {
    from: obj.from ? arr(obj.from) : undefined,
    to: obj.to ? arr(obj.to) : undefined,
    reason: obj.reason,
  };
}

function arr(x: PathGlobs): string[] {
  return typeof x === "string" ? [x] : [...x];
}
