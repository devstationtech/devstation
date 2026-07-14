# Skill: Domain

Use this skill when creating or modifying aggregates, entities, value objects, collections,
exceptions, domain events, or domain ports.

## Code References

Read the closest example before editing:

- Rich aggregate: `server/src/cluster/domain/models/proxmox/proxmox-cluster.ts`
- Aggregate with events and owned entity: `server/src/station/domain/models/station.ts`
- Simple aggregate: `server/src/vault/domain/models/vault.ts`
- Base aggregate: `server/src/shared/building-blocks/domain/models/aggregate.ts`
- Collections: `server/src/cluster/domain/models/proxmox/nodes/nodes.ts`, `server/src/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts`
- Shared VOs: `server/src/shared/building-blocks/domain/models/value-objects/`

## Aggregate

- Aggregate root `extends Aggregate`, never `implements Aggregate`.
- Constructor accepts domain objects only: VOs, entities, collections, optional `Version` for restore.
- Call `super(creation, version?)`; `version` starts at `1` by default in the base class.
- Static factory is named after the domain action (`register`, `create`, `open`) and receives VOs,
  not primitives and not `Operation` objects.
- Mutating methods are behavior-oriented (`registerNode`, `connect`, `installService`) and call
  `this.bump()` exactly when state changes.
- No I/O, no serialization, no framework/request/response types.
- Push domain events from aggregate methods; handlers dispatch events after persistence.

```ts
export class ProxmoxCluster extends Aggregate implements Cluster {
  readonly provider = Provider.PROXMOX;

  constructor(
    readonly id: Id,
    readonly name: Name,
    creation: Creation,
    readonly nodes: Nodes = new Nodes(),
    version?: Version,
  ) {
    super(creation, version);
  }

  registerNode(node: Node): void {
    this.nodes.register(node);
    this.bump();
  }

  static register(id: Id, name: Name, creation: Creation): ProxmoxCluster {
    return new ProxmoxCluster(id, name, creation);
  }
}
```

## No `domain/operations/`

Do not create operation classes. Do not add `toOperation()` as the standard translation path.
Commands carry primitives; handlers or factories build VOs/entities and call aggregate methods.

If an old spec or old skill mentions `domain/operations/`, treat it as legacy.

## Entities And Collections

- Entity has stable identity and lives inside the aggregate boundary.
- Aggregate owns entity lifecycle; entities do not reference the aggregate back.
- Entity classes may be immutable-returning (`Node.register(vm): Node`) or internally mutable when
  the aggregate owns the mutation (`VirtualMachine.recordService`). Keep the choice local and clear.
- Collection classes (`Nodes`, `Images`, `VirtualMachines`) encapsulate search and uniqueness rules.
- Expose collection contents as readonly copies (`readonly T[]` or copied arrays), not mutable internals.

## Value Objects

- Use shared base VOs when validation is identical: `Slug`, `Uuid`, `Integer`, `Instant`, `Creation`,
  `Credential`, `Vault`, `Secret`.
- Implement `ValueObject` directly only when the concept has custom validation or behavior.
- Invariants live in constructors/factories; throw a domain-relevant `Error`/exception immediately.
- Never pass raw primitives where a VO already names the concept.
- Enums live in their own files and use explicit string values.

## Exceptions

- Domain rule failures get explicit exceptions in `domain/exceptions/` when callers/tests need to
  distinguish the failure.
- Error messages should use domain language, not implementation details.
- Do not catch domain exceptions in the domain layer.

## Domain Events

- Concrete events live in `server/src/<bc>/domain/events/`.
- Event payload is minimal references, not embedded entity snapshots.
- Aggregate pushes events to `this.events`; handler persists first, then dispatches `events.pull()`.
- Cross-context reactions live in `inbound/policies/`; never import another BC's handlers directly.

## Domain Ports

- Ports are interfaces owned by the domain/application need, implemented by adapters.
- Outbound ports accept/return domain objects for write-side behavior.
- Use domain vocabulary: `of`, `byName`, `exists`, `add`, `update`, `remove`.
- Do not add `list()`/`all()` for UI reads. Read-side uses queries.
- If write-side scanning is unavoidable, name it explicitly, justify it in the port comment, and add
  or keep an architecture test that prevents UI/read-side use.
