import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

export type Type<E extends DomainEvent> = new (...args: never[]) => E;
