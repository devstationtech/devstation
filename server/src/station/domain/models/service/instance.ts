import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Role } from "@server/station/domain/models/service/role.ts";
import type { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";

/**
 * One participant of a service: the (role, host, credential) triple captured
 * when the operator assigns a VM to a role at register time.
 *
 * `host` is captured from the VM at register-time. If the underlying VM's
 * IP later changes (re-provision), the operator re-registers — service
 * doesn't auto-track cluster changes.
 */
export class Instance implements ValueObject {
  constructor(
    readonly role: Role,
    readonly host: string,
    readonly credential: Credential,
  ) {
    if (!host) throw new Error("instance host is required.");
  }
}
