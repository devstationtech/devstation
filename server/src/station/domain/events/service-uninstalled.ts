import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id } from "@server/station/domain/models/service/id.ts";
import type { Name } from "@server/station/domain/models/service/name.ts";
import type { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";

/**
 * Emitted when a service teardown succeeds. Mirrors `ServiceInstallSucceeded`:
 * carries the installations that were torn down so cross-BC listeners can clean
 * up without round-tripping back into the service domain:
 *
 * - `vault` + `serviceId` let the vault listener remove the service's secrets.
 * - the per-installation `host` lets the cluster listener drop the service from
 *   each VM's `services` projection.
 */
export class ServiceUninstalled implements DomainEvent {
  readonly eventId: EventId = new EventId();
  readonly occurredAt: Instant = new Instant();

  constructor(
    readonly serviceId: Id,
    readonly name: Name,
    readonly blueprint: BlueprintName,
    readonly vault: Vault,
    readonly installations: readonly Installation[],
  ) {}
}
