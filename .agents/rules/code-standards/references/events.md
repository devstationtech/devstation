# Domain Events & Policies

Cross-context communication is **asynchronous in intent, synchronous in execution** (in-process).
It avoids direct coupling between bounded contexts.

## Concepts

| Term | Definition | Location |
|---|---|---|
| `DomainEvent` | Fact that happened inside a context. Immutable, named, and carrying a minimal payload. | `server/src/<ctx>/domain/events/` (concrete events) and `server/src/shared/building-blocks/domain/events/` (contracts) |
| `Dispatcher`/`Bus` | Synchronous dispatch mechanism. Producers dispatch events after persistence. | `server/src/shared/building-blocks/domain/ports/events/outbound/` |
| `Policy` | Reaction from a consuming context. Reads a foreign event and translates it into a command from **its own context**. | shared contract and implementations in `server/src/<ctx>/inbound/policies/` |

## When To Create An Event

Real events are introduced only while migrating a concrete flow. Review each new event for:

- **Name:** past-tense verb (`ServiceInstallSucceeded`, `NodeApplySucceeded`)
- **Minimal payload:** references, not duplicated data
- **Owner:** context that produces the fact
- **Interested policies:** who reacts, and which own-context command each policy dispatches
- **Transactional consistency:** event is published after the producer context operation has been persisted

## Policy Naming

Format: `<consequence>-when-<trigger>.ts`. It should read like a sentence.

Examples:

- `record-virtual-machine-services-when-service-install-succeeded.ts`
- `store-service-secrets-when-service-install-succeeded.ts`

## Location

```text
server/src/<producer>/domain/events/
  <event-name>.ts

server/src/<consumer>/inbound/policies/
  <consequence>-when-<trigger>.ts
```

## Allowed Cross Imports

- `server/src/<ctx>/inbound/policies/**` may import `server/src/<other>/domain/events/**`.
- Policies may import commands/handlers from their own context.
- Any file may import shared event contracts/primitives from `server/src/shared/building-blocks/domain/**`.

## Still Forbidden

- Importing `domain/models` from another context
- Importing `application` from another context
- Importing `domain/ports/outbound` from another context
- Importing `outbound` from another context
- Importing `inbound/rpc` or `inbound/mcp` from another context

Policies are the only sanctioned cross-context entry point for reacting to events.

## Composition

`server/src/dependencies.ts` instantiates the bus/dispatcher and registers policies. Policies are
registered in the container individually; the composition root connects event and policy.

## Tests

Bus tests use fake events declared inline or in a shared fixture. Real events are tested when they
are created, together with their target policy.

## Non-Goals For Now

- Event persistence (event store / journal)
- Cross-process bus (Redis Streams, Kafka)
- Retry/dead-letter
- Cross-aggregate ordering
- Idempotency tokens
