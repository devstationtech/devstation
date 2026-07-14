/**
 * Filesystem discovery — small helper for finding top-level directories
 * matching a criterion. Useful for declaring rules across all matching
 * directories (e.g. each bounded context) without hardcoding the list.
 */

export type DiscoverOptions = {
  /** Project-relative path to scan (e.g. `"src/"`). */
  in: string;
  /**
   * If set, only directories that contain a child entry with this name are
   * returned. Use a trailing `/` to require a subdirectory (e.g. `"domain/"`),
   * or omit it to accept a file or directory.
   */
  containing?: string;
  /** Directory names to skip even if they otherwise match. */
  exclude?: readonly string[];
};

export async function discover(root: URL, opts: DiscoverOptions): Promise<string[]> {
  const exclude = new Set(opts.exclude ?? []);
  const baseDir = new URL(opts.in, root);
  const found: string[] = [];
  for await (const entry of Deno.readDir(baseDir)) {
    if (!entry.isDirectory || exclude.has(entry.name)) continue;
    if (opts.containing) {
      const requireDir = opts.containing.endsWith("/");
      const child = new URL(`${opts.in}${entry.name}/${opts.containing}`, root);
      try {
        const stat = await Deno.stat(child);
        if (requireDir ? !stat.isDirectory : !(stat.isFile || stat.isDirectory)) continue;
      } catch {
        continue;
      }
    }
    found.push(entry.name);
  }
  return found.sort();
}
