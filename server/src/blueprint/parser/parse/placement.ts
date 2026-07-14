import type { Placement } from "@server/blueprint/domain/models/placement.ts";

/** Default when `placement` is omitted. */
const DEFAULT_PLACEMENT: Placement = "exclusive";

export function placement({ raw, where }: { raw: unknown; where: string }): Placement {
  if (raw === undefined) return DEFAULT_PLACEMENT;
  if (raw === "exclusive" || raw === "shared") return raw;
  throw new Error(`${where}: placement must be 'exclusive' or 'shared'`);
}
