import type { RawVerify } from "@server/blueprint/parser/raw/verify.ts";
import type { RawPublish } from "@server/blueprint/parser/raw/publish.ts";
import type { RawRollback } from "@server/blueprint/parser/raw/rollback.ts";

/** Untrusted shape of one entry inside `steps[]`. */
export type RawStep = {
  name?: unknown;
  description?: unknown;
  run?: unknown;
  script?: unknown;
  env?: unknown;
  verify?: RawVerify;
  publish?: RawPublish;
  rollback?: RawRollback;
};
