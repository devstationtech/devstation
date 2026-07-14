# DDD Tactical Contracts

Tactical contracts live in `server/src/shared/building-blocks/domain/models/`.

- **VOs**: `implements ValueObject` or extend a shared VO (`Slug`, `Uuid`, `Integer`, ...)
- **Entities within aggregates**: `implements Entity` when identity matters
- **Aggregate roots**: `extends Aggregate`

`Aggregate` implements `Entity` and centralizes `creation`, `version`, and the in-memory domain event
bag. Every aggregate exposes `readonly id` and calls `super(creation, version?)`.

## No `domain/operations/`

The project does **not** use the `Operation` pattern in new code.

- `Command` in `application/commands/` carries primitive request input.
- `Handler` in `application/handlers/` or an explicit `Factory` translates primitives into
  VOs/entities and calls the aggregate directly: `aggregate.method(vo1, vo2)`.

Operations added indirection without behavior. Do not create `domain/operations/`, and do not copy
`toOperation()` from old specs. If existing code still has `toOperation()`, treat it as local legacy
and do not propagate it to new use cases.

## Cross-Context VOs Go To `shared`

When an identical VO appears in 2+ BCs and represents a reference to another BC's resource, promote
it to `server/src/shared/building-blocks/domain/models/value-objects/`.

Examples:

- `Vault(uuid)` referenced by `station/` and `cluster/`
- `Secret(uuid)` referenced by `station/` and `cluster/`
- `Credential { vault, username, password }` as a reference bundle

The owning BC still keeps the complete concept and rules. Other BCs consume only the shared
reference VO.

## Factories (`application/factories/`)

Use a factory when provider-specialized model construction would bloat the handler. Example:
`size/application/factories/size-factory.ts` builds `ProxmoxSize` from a
provider-specific command. Without provider-specialization or repeated construction complexity, do
not create a factory.
