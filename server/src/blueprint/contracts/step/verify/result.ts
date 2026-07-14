import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/** Result reported by a step's optional verify function. */
export class Result implements ValueObject {
  private constructor(readonly healthy: boolean, readonly reason?: string) {}

  static healthy(): Result {
    return new Result(true);
  }

  static unhealthy(reason: string): Result {
    if (!reason) throw new Error("unhealthy verify result requires a reason.");
    return new Result(false, reason);
  }
}
