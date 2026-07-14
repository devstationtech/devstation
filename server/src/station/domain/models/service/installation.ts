import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Role } from "@server/station/domain/models/service/role.ts";
import type { InstallResult } from "@server/station/domain/models/service/install-result.ts";

/**
 * Outcome of one instance's install run. Identifies the slot via `(role, host)`
 * and timestamps when this instance finished. Service persists a flat list of
 * these — single = list of 1, clustered = list of N — replaced atomically on
 * each successful install.
 */
export class Installation implements ValueObject {
  constructor(
    readonly role: Role,
    readonly host: string,
    readonly result: InstallResult,
    readonly at: Instant,
  ) {}

  /** Copy with the result's secret values dropped (see `InstallResult.sanitized`). */
  sanitized(): Installation {
    return new Installation(this.role, this.host, this.result.sanitized(), this.at);
  }
}
