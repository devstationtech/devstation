import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * Health probe declared on a step. The installer runs `shell` up to
 * `retryCount` times, sleeping `retryIntervalSeconds` between attempts.
 * Exit 0 means healthy; the step's apply is skipped when verify reports
 * healthy at the start of the run.
 */
export class Verify implements ValueObject {
  constructor(
    readonly shell: string,
    readonly retryCount: number,
    readonly retryIntervalSeconds: number,
  ) {
    if (!shell) throw new Error("verify.shell is required.");
    if (!Number.isInteger(retryCount) || retryCount < 1) {
      throw new Error("verify.retryCount must be an integer >= 1.");
    }
    if (!Number.isFinite(retryIntervalSeconds) || retryIntervalSeconds < 0) {
      throw new Error("verify.retryIntervalSeconds must be >= 0.");
    }
  }
}
