# Naming Conventions

## File Names

All files use **lowercase-kebab-case**.

| Artifact | File name | Example |
|---|---|---|
| Aggregate | `<aggregate>.ts` | `station.ts`, `vault.ts` |
| Provider aggregate | `<provider>-<aggregate>.ts` | `proxmox-cluster.ts` |
| Value Object | `<vo>.ts` | `name.ts`, `hostname.ts` |
| Entity | `<entity>.ts` | `secret.ts`, `node.ts` |
| Collection VO/entity collection | plural noun | `nodes.ts`, `virtual-machines.ts` |
| Exception | `<subject>-<condition>.ts` | `vault-already-exists.ts` |
| Command | `<action>-<subject>.ts` or provider folder + `<action>-<subject>.ts` | `register-cluster.ts`, `register-node.ts` |
| Handler | `<action>-<subject>-handler.ts` | `register-cluster-handler.ts` |
| Factory | `<subject>-factory.ts` | `size-factory.ts` |
| Port (outbound) | plural noun | `clusters.ts`, `vaults.ts` |
| Port (inbound) | `command.ts` | `command.ts` |
| Adapter | `adapter.ts` or concrete adapter name when several live together | `adapter.ts`, `factory-adapter.ts` |
| Query | `query.ts` | `query.ts` |
| Query record/type | descriptive record file | `cluster-record.ts`, `raw-cluster.ts` |
| RPC/MCP endpoint | `endpoint.ts` | `endpoint.ts` |
| Test | `<subject>.test.ts` | `cluster.test.ts` |
| MCP E2E scenario | `<scenario>.mcptest.ts` | `vault.mcptest.ts` |

Do not create new `domain/operations/` files.

## Class Names

All classes use **PascalCase**. Classes are context-free within their own module unless provider or
wire protocol clarity requires a prefix.

| Artifact | Pattern | Example |
|---|---|---|
| Aggregate | `<Aggregate>` or `<Provider><Aggregate>` | `Station`, `Vault`, `ProxmoxCluster` |
| Value Object | `<Vo>` | `Name`, `Hostname`, `Uuid` |
| Entity | `<Entity>` | `Secret`, `Node`, `VirtualMachine` |
| Exception | `<Subject><Condition>` | `VaultAlreadyExists` |
| Command | `<Action><Subject>` | `RegisterCluster`, `CreateVault` |
| Handler | `<Action><Subject>Handler` | `RegisterClusterHandler` |
| Factory | `<Subject>Factory` | `SizeFactory` |
| Port (outbound) | plural noun | `Clusters`, `Vaults` |
| Adapter | `Adapter` when path scopes it; otherwise concrete role | `Adapter`, `ProxmoxReadApiAdapterFactory` |
| Query | `Query` | `Query` |
| RPC endpoint | `<Action><Subject>Endpoint` | `RegisterNodeEndpoint` |
| MCP endpoint | `<Action><Subject>McpEndpoint` | `RegisterNodeMcpEndpoint` |

## Directory Structure

```text
server/src/<context>/
  domain/
    models/
    exceptions/
    events/
    ports/
  application/
    commands/
    handlers/
    factories/
    services/
    queries/
  inbound/
    rpc/
    mcp/
    policies/
  outbound/
    persistence/
    executions/
```

## Method Names

- All methods: `camelCase`
- Static factories on aggregates: named after domain action, such as `register`, `create`, `open`
- Static factories on VOs: `fromString`, `now`, `generate`, `after`
- Private methods: `private methodName()` (no `#`)
- Port methods use domain vocabulary: `of`, `byName`, `exists`, `add`, `update`, `remove`
- Do not add generic `list()`/`all()` for UI reads to outbound ports. If write-side scanning is
  required, give it an explicit name and justification.
