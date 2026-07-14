# Skill: Query Read Models

Use this skill when creating or modifying read models in `server/src/<bc>/application/queries/`.

## Code References

- Generic cluster read: `server/src/cluster/application/queries/all/query.ts`
- Provider read with enrichment: `server/src/cluster/application/queries/proxmox/node/all/query.ts`
- Query boundary tests: `server/tests/architecture/query.test.ts`
- Query integration tests: `server/tests/cluster/integration/application/queries/`

## Purpose

Queries are isolated read models. They bypass aggregates and outbound write ports, read persisted
records/provider APIs directly, and return plain JSON-friendly records.

## Structure

```text
server/src/<bc>/application/queries/
  all/query.ts
  all/types/raw-<thing>.ts
  records/<thing>-record.ts
  <provider>/...
```

Rules:

- Query class is named `Query`; path supplies context.
- Constructor receives explicit dependencies (`FileSystem`, provider API factory, optional logger).
- `execute(...)` returns records, not domain objects.
- `types/raw-*.ts` describe persisted raw shape.
- `records/*.ts` describe public read model shape.
- No imports from `server/src/<bc>/domain/**` or `server/src/<bc>/outbound/**`.
- No cross-BC imports except `server/src/shared/**`; blueprint catalog exception is arch-tested.

## Storage Reads

- Use `FileSystem.readObjectsOf<T>(FILE)` for persisted JSON arrays.
- Treat first-run empty storage according to the `FileSystem` contract.
- Do not use broad `catch { return [] }` to hide corrupt JSON, shape errors, or provider bugs unless
  the endpoint contract explicitly requires graceful degradation.

```ts
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<ClusterRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>("clusters.json");
    return clusters.map((cluster) => ({ id: cluster.id, name: cluster.name }));
  }
}
```

## Generic vs Provider-Specific

- Generic reads (`cluster/application/queries/all`, `by-id`, `records`) return fields common to every provider.
- Generic reads must not import provider-specific query slices.
- Provider-specific reads live under `<provider>/` and use provider vocabulary honestly.
- Provider records are prefixed with provider when exported (`ProxmoxNodeRecord`).
- Provider connection/secret resolution lives inside the provider query/factory, not in UI callers.

## Provider Enrichment

Provider enrichment can degrade gracefully when list endpoints must remain usable offline or with
insufficient provider permissions.

- Return static persisted records when enrichment fails.
- Log enough context with `Logger` to explain the degraded path.
- Do not leak secrets in logs.

## Tests

- Test query classes directly, not through RPC/MCP endpoints.
- Use real temp persistence helpers for integration tests.
- Cover first-run empty storage, normal projection, provider-specific branches, and graceful degraded
  behavior when that is the contract.
- Update `server/tests/architecture/query.test.ts` when adding a new query slice or exception.
