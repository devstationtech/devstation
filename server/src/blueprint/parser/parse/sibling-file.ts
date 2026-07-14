import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

/**
 * Reads a file referenced from `blueprint.yaml` — a `scripts/install.sh`
 * or `assets/operator.yaml`. `fs` is rooted at the blueprint's own
 * directory, so the path resolves relative to it.
 */
export function readSiblingFile(
  { path, fs }: { path: string; fs: FileSystem },
): Promise<string> {
  return fs.read(path);
}
