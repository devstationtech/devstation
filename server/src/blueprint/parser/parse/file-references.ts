import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { readSiblingFile } from "@server/blueprint/parser/parse/sibling-file.ts";

const FILE_REFERENCE = /\$\{file:([^}]+)\}/g;

/**
 * Replaces every `${file:path}` occurrence in `template` with the contents
 * of the referenced file. Resolution happens at parse time — by the time
 * the step runs, every reference is literal text.
 */
export async function inlineFileReferences(
  { template, fs }: { template: string; fs: FileSystem },
): Promise<string> {
  const matches = [...template.matchAll(FILE_REFERENCE)];
  let result = template;
  for (const match of matches) {
    const path = match[1].trim();
    const content = await readSiblingFile({ path, fs });
    result = result.replaceAll(match[0], content);
  }
  return result;
}
