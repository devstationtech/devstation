import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id } from "@server/station/domain/models/service/id.ts";
import type { Name } from "@server/station/domain/models/service/name.ts";
import type { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";

/**
 * Carries enough context for cross-BC listeners (vault, cluster) to route +
 * project without round-tripping back through the service repository:
 *
 * - `vault` tells the vault listener which vault to write to.
 * - `name` + `stack` give the cluster listener display strings for
 *   `vm.services` without crossing back into the service domain.
 */
export class ServiceInstallSucceeded implements DomainEvent {
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
