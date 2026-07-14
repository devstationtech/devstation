# @operations — Long-Running Operations infrastructure

Infrastructure package for tracking and streaming long-running async work in DevStation. Provides
the in-memory implementation of the `Operations` port, the JSON-RPC endpoints (`operation.cancel`,
`operation.list`, `operation.watch`) and the client-side integration that converts wire
notifications into an `AsyncIterable`.

This package is **infrastructure**, not domain. Bounded contexts depend on the ports defined in
`src/shared/domain/ports/outbound/operations/` (`Operations`, `Operation`, `Task`, `OperationEvent`,
base events) — they never import from this package directly. The composition root wires the package
as the adapter that implements those ports.

## Streaming model

We follow the **LSP-style** pattern (Microsoft's Language Server Protocol — JSON-RPC 2.0 over
stdio): a BC endpoint that does long-running work keeps the request **pending** during execution,
emits progress notifications on the same channel, and resolves the request with a **typed response**
that carries the structured result. Cancellation rides a parallel request (`operation.cancel`) that
signals abort to the running task; the original request then resolves with a cancellation error.

The endpoints in this package — `operation.cancel`, `operation.list`, `operation.watch` — are
**secondary**: they exist for cross-cutting concerns (cancelling from elsewhere, observability
screens, attaching to an operation already in flight). The primary flow is BC-owned: each BC
declares its typed Response in its own OpenRPC schema and emits progress notifications during its
endpoint's dispatch.

The wire shape follows the LSP-style pattern: the BC endpoint keeps the request pending, emits
progress notifications, and resolves with a typed response. See the references section below for
protocol links.

## Conventions

The terminology trio **Succeeded / Failed / Cancelled** is the consensus past-participle form used
by AWS Step Functions, Argo Workflows, GitHub Actions, OpenTelemetry, and Apache Airflow.

The name **`Operation`** is borrowed from Google's
[AIP-151 Long Running Operations](https://google.aip.dev/151) and the broader cloud API vocabulary
(AWS, Azure use the same noun). Note that we adopt only the **name** — the actual streaming
mechanics here follow LSP (request stays pending + notifications), not AIP-151's poll-a-handle
pattern.

## Layout

```
packages/operations/
  outbound/
    in-memory-operations.ts   — InMemoryOperations (default Operations adapter)
    in-memory-operation.ts    — InMemoryOperation (buffered, replayable stream)
  rpc/
    operations.openrpc.json   — schema for cancel/list/watch + OperationEvent envelope
    cancel/endpoint.ts        — operation.cancel (best-effort)
    list/endpoint.ts          — operation.list (snapshot for observability)
    watch/endpoint.ts         — operation.watch (attach to an in-flight op)
    event-mapper.ts           — domain event class → wire tagged-union
    endpoints.ts              — catalog
  client/
    operations-integration.ts — UI helper for watch (AsyncIterable + onNotification)
  mod.ts                      — public API
```

## References

- **LSP 3.17** —
  <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/>
- **LSP `$/progress`** —
  <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#progress>
- **MCP Progress utility** —
  <https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress>
- **Kubernetes `watch` verb** —
  <https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes>
- **Google AIP-151** (name only; mechanics differ) — <https://google.aip.dev/151>
- **AWS Step Functions Executions** —
  <https://docs.aws.amazon.com/step-functions/latest/dg/concepts-state-machine-executions.html>
