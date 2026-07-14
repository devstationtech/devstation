import type { RawPublish } from "@server/blueprint/parser/raw/publish.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { sourceMap } from "@server/blueprint/parser/parse/publish/source-map.ts";

/**
 * Parses `step.publish`, splitting it into separate maps for `secret` and
 * `fact` entries.
 */
export function publish(
  { raw, where }: { raw: RawPublish | undefined; where: string },
): Publish {
  if (raw === undefined || raw === null) return new Publish({}, {});
  return new Publish(
    sourceMap({ raw: raw.secret, where: `${where}.publish.secret` }),
    sourceMap({ raw: raw.fact, where: `${where}.publish.fact` }),
  );
}
