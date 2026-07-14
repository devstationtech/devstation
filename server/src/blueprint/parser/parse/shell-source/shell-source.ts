import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { inlineFileReferences } from "@server/blueprint/parser/parse/file-references.ts";
import { readSiblingFile } from "@server/blueprint/parser/parse/sibling-file.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";
import type { RawShellSource } from "@server/blueprint/parser/parse/shell-source/raw-shell-source.ts";

/**
 * Resolves a step's shell body from either an inline `run:` heredoc or a
 * sibling `script:` file. Mutex is enforced; whichever is provided gets
 * `${file:...}` references inlined before being handed to the compiler.
 */
export async function shellSource(
  { raw, fs, where }: { raw: RawShellSource; fs: FileSystem; where: string },
): Promise<string> {
  const hasRun = raw.run !== undefined && raw.run !== null;
  const hasScript = raw.script !== undefined && raw.script !== null;

  if (hasRun && hasScript) {
    throw new Error(`${where}: 'run' and 'script' are mutually exclusive`);
  }
  if (!hasRun && !hasScript) {
    throw new Error(`${where}: declare 'run' (inline shell) or 'script' (path to .sh file)`);
  }

  const body = hasRun ? string({ value: raw.run, where: `${where}.run` }) : await readSiblingFile({
    path: string({ value: raw.script, where: `${where}.script` }),
    fs,
  });

  return inlineFileReferences({ template: body, fs });
}
