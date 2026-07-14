import type { Instances } from "@server/blueprint/domain/models/instances.ts";

/** Default when `instances` is omitted on a role. */
const DEFAULT_INSTANCES: Instances = "one";

const ALLOWED: Instances[] = ["one", "many", "zeroOrMore"];

export function instances({ raw, where }: { raw: unknown; where: string }): Instances {
  if (raw === undefined) return DEFAULT_INSTANCES;
  if ((ALLOWED as unknown[]).includes(raw)) return raw as Instances;
  // The parser is the single source of truth via the `ALLOWED` table
  // so the error message and the accepted set can never drift apart.
  throw new Error(
    `${where}.instances: invalid value ${JSON.stringify(raw)}. ` +
      `Must be one of: ${ALLOWED.map((v) => `'${v}'`).join(", ")}.`,
  );
}
