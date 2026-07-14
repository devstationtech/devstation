import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { ProvisioningPolicy } from "@server/cluster/domain/models/proxmox/connection/provisioning-policy.ts";

export class Connection implements ValueObject {
  constructor(
    readonly host: Hostname,
    readonly vault: Vault,
    readonly secret: Secret,
    // Absent in legacy records → default (auto-detect clone, serial apply).
    readonly policy: ProvisioningPolicy = ProvisioningPolicy.default(),
  ) {}
}
