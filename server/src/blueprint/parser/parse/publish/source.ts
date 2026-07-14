import type { PublishSource } from "@server/blueprint/domain/models/step/publish-source.ts";

const FILE_PREFIX = "file:";
const STDOUT_LINE_PREFIX = "stdout-line:";

/**
 * Parses one `PublishSource` shorthand. Accepts only `file:/path/...` or
 * `stdout-line:PREFIX=`; throws on any other shape.
 */
export function source({ raw, where }: { raw: unknown; where: string }): PublishSource {
  if (typeof raw !== "string") {
    throw new Error(`${where}: must be a string`);
  }
  if (raw.startsWith(FILE_PREFIX)) {
    return { kind: "file", path: raw.slice(FILE_PREFIX.length) };
  }
  if (raw.startsWith(STDOUT_LINE_PREFIX)) {
    return { kind: "stdoutLine", prefix: raw.slice(STDOUT_LINE_PREFIX.length) };
  }
  throw new Error(`${where}: must start with 'file:' or 'stdout-line:'`);
}
