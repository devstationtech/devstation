import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawVerify } from "@server/blueprint/parser/raw/verify.ts";
import { Verify } from "@server/blueprint/domain/models/step/verify.ts";
import { inlineFileReferences } from "@server/blueprint/parser/parse/file-references.ts";
import { number } from "@server/blueprint/parser/parse/primitives/number.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_INTERVAL_SECONDS = 0;

export async function verify(
  { raw, fs, where }: {
    raw: RawVerify | undefined;
    fs: FileSystem;
    where: string;
  },
): Promise<Verify | null> {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") {
    throw new Error(`${where}: must be a mapping`);
  }
  const shell = await inlineFileReferences({
    template: string({ value: raw.run, where: `${where}.run` }),
    fs,
  });
  const retryCount = raw.retry?.count !== undefined
    ? number({ value: raw.retry.count, where: `${where}.retry.count` })
    : DEFAULT_RETRY_COUNT;
  const retryIntervalSeconds = raw.retry?.intervalSeconds !== undefined
    ? number({ value: raw.retry.intervalSeconds, where: `${where}.retry.intervalSeconds` })
    : DEFAULT_RETRY_INTERVAL_SECONDS;
  return new Verify(shell, retryCount, retryIntervalSeconds);
}
