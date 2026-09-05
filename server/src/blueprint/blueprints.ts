import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import type { Name } from "@server/blueprint/domain/models/name.ts";
import { BlueprintNotFound } from "@server/blueprint/exceptions/blueprint-not-found.ts";
import { parseBlueprint } from "@server/blueprint/parser/yaml.ts";

const ENTRYPOINT = "blueprint.yaml";

/** Where a blueprint came from: the bundled catalog or the user's local dir. */
export type BlueprintOrigin = "official" | "local";

/** A blueprint plus its provenance, for read models that mark local ones. */
export type BlueprintEntry = { readonly blueprint: Blueprint; readonly origin: BlueprintOrigin };

/** A catalog root and the origin every blueprint found under it gets tagged with. */
export type BlueprintSource = { readonly fs: FileSystem; readonly origin: BlueprintOrigin };

/**
 * Catalog of blueprints — `of(name)`, `contains(name)`, `list()`. Reads
 * `<root>/<name>/blueprint.yaml` files via the YAML parser, which produces
 * domain Blueprint objects whose steps are pure descriptors. Callers don't
 * see the on-disk shape.
 *
 * A catalog can layer several sources (e.g. the bundled `blueprints/` plus the
 * user's `~/.devstation/blueprints`). Sources are applied in order and **later
 * sources override earlier ones on name collision** — callers pass official
 * first and user-local last, so a user's blueprint always wins over a bundled
 * one of the same name. Each entry keeps its `origin` so read models can mark
 * local blueprints. A missing source directory simply contributes nothing.
 *
 * Caches the catalog, validated against the disk on every read: the cache is
 * keyed by a fingerprint of each source's blueprint dirs and their
 * `blueprint.yaml` mtimes, so a `blueprint register` from ANOTHER process
 * (the CLI writing to the shared user dir) is picked up by a long-running
 * engine (MCP) on its next read — no reconnect, no reload tool. The stat
 * sweep is a few dozen syscalls; parsing only re-runs when something
 * actually changed. Callers that must stay atomic (an install execution)
 * resolve their Blueprint once up front — invalidation only affects the
 * next resolution, never a running execution.
 */
export class Blueprints {
  private cache: { fingerprint: string; map: Map<string, BlueprintEntry> } | null = null;
  private readonly sources: readonly BlueprintSource[];

  constructor(source: FileSystem | readonly BlueprintSource[]) {
    this.sources = Array.isArray(source)
      ? source
      : [{ fs: source as FileSystem, origin: "official" }];
  }

  async of(name: Name): Promise<Blueprint> {
    return (await this.entryOf(name)).blueprint;
  }

  /** Like `of`, but keeps the blueprint's origin. Throws if not found. */
  async entryOf(name: Name): Promise<BlueprintEntry> {
    const all = await this.loadAll();
    const found = all.get(name.value);
    if (!found) throw new BlueprintNotFound(name);
    return found;
  }

  async contains(name: Name): Promise<boolean> {
    const all = await this.loadAll();
    return all.has(name.value);
  }

  async list(): Promise<Blueprint[]> {
    return (await this.entries()).map((e) => e.blueprint);
  }

  /** All blueprints with their origin (local ones already win over official). */
  async entries(): Promise<BlueprintEntry[]> {
    const map = await this.loadAll();
    return [...map.values()];
  }

  private async loadAll(): Promise<Map<string, BlueprintEntry>> {
    const fingerprint = await this.fingerprint();
    if (this.cache && this.cache.fingerprint === fingerprint) return this.cache.map;
    const map = new Map<string, BlueprintEntry>();
    for (const source of this.sources) {
      for (const dirName of await source.fs.listDirs()) {
        const blueprint = await this.loadFromDir(source.fs, dirName);
        if (blueprint) map.set(blueprint.name.value, { blueprint, origin: source.origin });
      }
    }
    this.cache = { fingerprint, map };
    return map;
  }

  /** Dirs and entrypoint mtimes across all sources — cheap staleness probe. */
  private async fingerprint(): Promise<string> {
    const parts: string[] = [];
    for (const source of this.sources) {
      for (const dirName of (await source.fs.listDirs()).sort()) {
        const mtime = await source.fs.subdir(dirName).modifiedAt(ENTRYPOINT);
        parts.push(`${source.origin}:${dirName}:${mtime ?? "-"}`);
      }
    }
    return parts.join("|");
  }

  private async loadFromDir(fs: FileSystem, dirName: string): Promise<Blueprint | null> {
    const subdir = fs.subdir(dirName);
    if (!await subdir.exists(ENTRYPOINT)) return null;
    return await parseBlueprint(await subdir.read(ENTRYPOINT), subdir);
  }
}
