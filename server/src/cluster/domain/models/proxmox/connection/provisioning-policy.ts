import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import {
  CloneStrategy,
  cloneStrategyFrom,
} from "@server/cluster/domain/models/proxmox/connection/clone-strategy.ts";

/**
 * Per-connection provisioning knobs: how to clone VMs and how many to
 * clone in parallel. Absent in legacy connection records → `default()`
 * (auto-detect clone, serial apply).
 */
export class ProvisioningPolicy implements ValueObject {
  constructor(
    readonly cloneStrategy: CloneStrategy,
    readonly parallelism: number,
  ) {
    if (!Number.isInteger(parallelism) || parallelism < 1) {
      throw new Error("parallelism must be a positive integer.");
    }
  }

  static default(): ProvisioningPolicy {
    return new ProvisioningPolicy(CloneStrategy.AUTO, 1);
  }

  static from(
    cloneStrategy: string | undefined,
    parallelism: number | undefined,
  ): ProvisioningPolicy {
    return new ProvisioningPolicy(
      cloneStrategyFrom(cloneStrategy),
      parallelism ?? 1,
    );
  }

  equals(other: ProvisioningPolicy): boolean {
    return this.cloneStrategy === other.cloneStrategy &&
      this.parallelism === other.parallelism;
  }
}
