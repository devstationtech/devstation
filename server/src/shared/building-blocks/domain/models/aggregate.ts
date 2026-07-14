import type { Entity } from "@server/shared/building-blocks/domain/models/entity.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { EventBag } from "@server/shared/building-blocks/domain/events/event-bag.ts";

/**
 * Base class for all aggregates. Enforces identity, versioning, creation
 * metadata, and an in-memory queue of domain events the aggregate produced
 * while mutating.
 *
 * Concrete aggregates push events directly via `this.events.push(event)` from
 * inside their mutating methods. The orchestrator (handler, session, etc.)
 * drains the queue via `aggregate.events.pull()` after persisting and
 * dispatches them on the bus. The queue is in-memory only — never serialized.
 */
export abstract class Aggregate implements Entity {
  abstract readonly id: unknown;
  private _version: Version;
  readonly events: EventBag = new EventBag();

  constructor(
    /** Records who created the aggregate and when. */
    readonly creation: Creation,
    version: Version = new Version(1),
  ) {
    this._version = version;
  }

  /** Current version of the aggregate. Starts at 1 and increments on each mutation. */
  get version(): Version {
    return this._version;
  }

  /** Increments the version. Must be called at the end of every mutating method. */
  protected bump(): void {
    this._version = this._version.next();
  }
}
