import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawRollback } from "@server/blueprint/parser/raw/rollback.ts";
import { shellSource } from "@server/blueprint/parser/parse/shell-source/shell-source.ts";

/**
 * Parses a step's optional rollback block. Same `run`/`script` mutex as
 * `apply`; returns `null` when neither is provided.
 */
// deno-lint-ignore require-await -- async normalizes the early `null` returns with shellSource's Promise
export async function rollback(
  { raw, fs, where }: {
    raw: RawRollback | undefined;
    fs: FileSystem;
    where: string;
  },
): Promise<string | null> {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") {
    throw new Error(`${where}.rollback: must be a mapping`);
  }
  const hasRun = raw.run !== undefined && raw.run !== null;
  const hasScript = raw.script !== undefined && raw.script !== null;
  if (!hasRun && !hasScript) return null;
  return shellSource({ raw, fs, where: `${where}.rollback` });
}
