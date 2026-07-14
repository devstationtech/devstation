import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ListBlueprintsMcpEndpoint } from "@server/blueprint/inbound/mcp/list/endpoint.ts";
import { WatchExecutionMcpEndpoint } from "@server/shared/executions/inbound/mcp/watch/endpoint.ts";
import { CancelExecutionMcpEndpoint } from "@server/shared/executions/inbound/mcp/cancel/endpoint.ts";
import { ListExecutionsMcpEndpoint } from "@server/shared/executions/inbound/mcp/list/endpoint.ts";
import { RpcVersionMcpEndpoint } from "@server/shared/inbound/mcp/rpc-version/endpoint.ts";
import { Protocol } from "@server/shared/inbound/rpc/protocol.ts";
import type { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";

/**
 * Pins the per-BC MCP endpoints for blueprints and executions.
 *
 * Coverage:
 *  - `ListBlueprintsMcpEndpoint` (blueprint BC) — query delegate +
 *    reuses the `toWire` mapper the RPC counterpart uses.
 *  - `WatchExecutionMcpEndpoint` (executions sub-BC) — drains the
 *    AsyncIterable synchronously, returns the events array (MCP has
 *    no mid-tools/call notification channel).
 *  - `CancelExecutionMcpEndpoint` — best-effort, returns empty Ack.
 *  - `ListExecutionsMcpEndpoint` — returns one id per tracked op.
 *  - `RpcVersionMcpEndpoint` (shared, no BC) — pure constant; mirrors
 *    the inline `rpc.version` short-circuit in `rpc/server.ts`.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeBlueprintsQuery(records: unknown[]): AllBlueprintsQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

function asyncIterableOf<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of values) yield v;
    },
  };
}

function fakeExecutions(opts: {
  watch?: unknown[];
  all?: Array<{ id: string }>;
  cancelled?: string[];
}): Executions {
  const cancelled = opts.cancelled ?? [];
  const stub = {
    of(_id: string): Execution {
      return { watch: () => asyncIterableOf(opts.watch ?? []) } as Anyish as Execution;
    },
    all(): Execution[] {
      return (opts.all ?? []).map((o) => ({ id: o.id }) as Anyish);
    },
    cancel(id: string): Promise<void> {
      cancelled.push(id);
      return Promise.resolve();
    },
  } as Anyish;
  return stub as Executions;
}

describe("ListBlueprintsMcpEndpoint", () => {
  it("delegates to AllBlueprintsQuery and applies toWire (renames default→value)", async () => {
    /* @Given a blueprint record with a declared-input `default` field */
    const endpoint = new ListBlueprintsMcpEndpoint(fakeBlueprintsQuery([
      {
        id: "k3s",
        name: "k3s",
        description: "Kubernetes cluster",
        version: "1.0.0",
        inputs: [{ key: "cluster_id", type: "string", default: "homelab" }],
        steps: [],
      },
    ]));
    /* @When dispatch runs */
    const out = await endpoint.dispatch() as Array<{
      inputs: Array<{ key: string; value?: string }>;
    }>;
    /* @Then the `default` field becomes `value` (contract via `toWire`) */
    assertEquals(out[0].inputs[0].key, "cluster_id");
    assertEquals(out[0].inputs[0].value, "homelab");
  });
});

describe("WatchExecutionMcpEndpoint", () => {
  it("drains the operation event stream and returns the events array", async () => {
    /* @Given an operation that yields three events */
    const events = [
      { type: "log", message: "hello" },
      { type: "step", name: "init" },
      { type: "succeeded", at: "2026-05-20T00:00:00.000Z" },
    ];
    const endpoint = new WatchExecutionMcpEndpoint(fakeExecutions({ watch: events }));
    /* @When dispatch runs */
    const out = await endpoint.dispatch({ executionId: "exec-1" });
    /* @Then every event landed on `events`; `result` is empty Ack */
    assertEquals(out.result, {});
    assertEquals(out.events, events);
  });

  it("returns an empty events array when the stream is empty", async () => {
    const endpoint = new WatchExecutionMcpEndpoint(fakeExecutions({ watch: [] }));
    const out = await endpoint.dispatch({ executionId: "exec-empty" });
    assertEquals(out.events, []);
  });
});

describe("CancelExecutionMcpEndpoint", () => {
  it("forwards the cancel to the Executions port and returns empty Ack", async () => {
    const cancelled: string[] = [];
    const endpoint = new CancelExecutionMcpEndpoint(fakeExecutions({ cancelled }));
    const out = await endpoint.dispatch({ executionId: "exec-1" });
    assertEquals(out, {});
    assertEquals(cancelled, ["exec-1"]);
  });
});

describe("ListExecutionsMcpEndpoint", () => {
  it("returns one id per tracked execution", () => {
    const endpoint = new ListExecutionsMcpEndpoint(
      fakeExecutions({ all: [{ id: "exec-a" }, { id: "exec-b" }] }),
    );
    const out = endpoint.dispatch();
    assertEquals(out, [{ id: "exec-a" }, { id: "exec-b" }]);
  });
});

describe("RpcVersionMcpEndpoint", () => {
  it("returns the Protocol handshake with the injected core version", () => {
    const endpoint = new RpcVersionMcpEndpoint("0.99.0");
    const out = endpoint.dispatch();
    assertEquals(out, { protocol: Protocol.VERSION, core: "0.99.0" });
  });
});
