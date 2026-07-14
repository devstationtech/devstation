import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Step } from "@server/blueprint/domain/models/step/step.ts";
import { Description as StepDescription } from "@server/blueprint/domain/models/step/description.ts";
import { Id as StepId } from "@server/blueprint/domain/models/step/id.ts";
import type { RawStep } from "@server/blueprint/parser/raw/step.ts";
import { shellSource } from "@server/blueprint/parser/parse/shell-source/shell-source.ts";
import { envMap } from "@server/blueprint/parser/parse/env-map.ts";
import { verify } from "@server/blueprint/parser/parse/verify.ts";
import { publish } from "@server/blueprint/parser/parse/publish/publish.ts";
import { rollback } from "@server/blueprint/parser/parse/rollback.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

/**
 * Parses one raw step entry into a domain Step descriptor. Each piece
 * (`run`/`script`, `env`, `verify`, `publish`, `rollback`) has its own
 * parser; the result is a pure-data Step that the installer interprets at
 * run time.
 */
export async function step(
  { raw, fs, where }: { raw: RawStep; fs: FileSystem; where: string },
): Promise<Step> {
  return new Step(
    new StepId(string({ value: raw.name, where: `${where}.name` })),
    new StepDescription(string({ value: raw.description, where: `${where}.description` })),
    await shellSource({ raw, fs, where }),
    envMap({ raw: raw.env, where }),
    await verify({ raw: raw.verify, fs, where: `${where}.verify` }),
    publish({ raw: raw.publish, where }),
    await rollback({ raw: raw.rollback, fs, where }),
  );
}
