# Skill: Command And Handler

Use this skill when creating or modifying commands, handlers, factories, or write-side application
services.

## Code References

- Simple create: `server/src/vault/application/handlers/create-vault-handler.ts`
- Provider factory: `server/src/size/application/factories/size-factory.ts`
- Aggregate update with serialized port update: `server/src/cluster/application/handlers/proxmox/register-node-handler.ts`
- Long-running orchestration: `server/src/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts`
- Event dispatch after persistence: `server/src/station/application/handlers/register-station-handler.ts`

## Command

- Command is a DTO for user intent crossing from inbound to application.
- Constructor accepts primitives only (`string`, `number`, `boolean`, arrays/plain objects of primitives).
- Command may implement the BC's `Command` marker interface when the BC has one.
- Do not add `toOperation()`.
- Prefer no domain construction inside commands. Existing `toNode()`/`toVirtualMachine()` methods are
  legacy-local convenience in cluster; do not copy them to new use cases.
- If input shape gets nested, use exported primitive `type`s in the same command file only when they
  are part of the command contract.

```ts
export class CreateVault {
  constructor(
    readonly name: string,
    readonly user: string,
    readonly hostname: string,
  ) {}
}
```

## Handler

- One handler per use case.
- Constructor receives ports/services via dependency injection; depend on interfaces where available.
- Public method is `handle(command): Promise<...>`.
- Handler does orchestration: preconditions, primitive -> VO/entity translation, aggregate call,
  persistence, event dispatch.
- Business invariants belong in domain; repository uniqueness/existence checks happen in handler.
- Return generated identifiers when inbound adapters need to echo them to MCP/agent callers.

```ts
export class CreateVaultHandler {
  constructor(private readonly vaults: Vaults) {}

  async handle(command: CreateVault): Promise<{ vaultId: string }> {
    const name = new Name(command.name);
    if (await this.vaults.exists(name)) throw new VaultAlreadyExists();

    const vault = Vault.create(
      name,
      Creation.now(new User(command.user), new Hostname(command.hostname)),
    );
    await this.vaults.save(vault);
    return { vaultId: vault.id.value };
  }
}
```

## Updating Existing Aggregates

- Use the outbound port's serialized update method when it exists (`clusters.update(...)`).
- Not every port has `update()` — smaller BCs (e.g. `Vaults`) legitimately use
  load-mutate-save: `of(id)` → aggregate method → `save(aggregate)`. Mirror the
  port you are given; do **not** add `update()` just to match this example.
- Build target IDs before the update closure.
- Keep long-running external work outside serialized write locks.
- Inside the closure, call aggregate methods; do not mutate persisted records manually.

```ts
await this.clusters.update<ProxmoxCluster>(new Id(command.clusterId), (cluster) => {
  cluster.registerNode(node);
});
```

## Factories

Create `application/factories/` only when construction varies by provider or repeated construction
would make handlers noisy.

- Factory receives the command or explicit primitive values.
- Factory builds VOs/entities/aggregate variants.
- Factory throws domain/application exceptions for unsupported providers.
- Factory does not perform I/O.

## Application Services

Use `application/services/` only for orchestration that does not fit a single aggregate method or
handler body, especially multi-step execution flows. Services still follow layer rules: no inbound
or outbound adapter imports unless injected through ports.

## Anti-Patterns

- `Request -> Command -> Operation -> Aggregate`
- command methods named `toOperation()`
- handler passing raw primitives into aggregate methods when a VO exists
- handler directly reading/writing JSON records instead of using a port
- inbound endpoint importing outbound adapter
