import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";

/** Context passed to the synchronous template resolver. */
export type ResolveContext = {
  readonly ctx: StepContext;
  readonly host: string;
};
