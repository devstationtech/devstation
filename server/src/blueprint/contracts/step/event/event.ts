import type { Log } from "@server/blueprint/contracts/step/event/log.ts";
import type { Progress } from "@server/blueprint/contracts/step/event/progress.ts";
import type { Secret } from "@server/blueprint/contracts/step/event/secret.ts";
import type { Fact } from "@server/blueprint/contracts/step/event/fact.ts";

/** Discriminated union of every event a step's `apply` generator can yield. */
export type Event = Log | Progress | Secret | Fact;
