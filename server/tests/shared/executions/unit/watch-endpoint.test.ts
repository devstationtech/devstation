import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { WatchEndpoint } from "@server/shared/executions/inbound/rpc/watch/endpoint.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";

/**
 * `execution.watch` endpoint — unit-level. The integration suite
 * covers the streamed-notifications happy path; this pins the
 * `if (!ctx) continue;` branch (an endpoint dispatched WITHOUT a
 * notification context still drains the event stream and resolves
 * with an empty ack — no crash, no leak).
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function asyncIterableOf<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of values) yield v;
    },
  };
}

/** Fake Executions whose `of()` yields an operation streaming `events`. */
function executionsYielding(events: unknown[]): Executions {
  const operation = { watch: () => asyncIterableOf(events) } as Anyish as Execution;
  return { of: () => operation } as Anyish as Executions;
}

describe("WatchEndpoint", () => {
  it("declares method 'execution.watch' and is a streaming endpoint", () => {
    const endpoint = new WatchEndpoint(executionsYielding([]));
    assertEquals(endpoint.method, "execution.watch");
    assertEquals(endpoint.streaming, true);
  });

  it("forwards every event to ctx.notify and resolves with an empty ack", async () => {
    /* @Given an operation streaming two events */
    const events = [{ type: "log", line: "hi" }, { type: "succeeded" }];
    const endpoint = new WatchEndpoint(executionsYielding(events));
    const notified: Array<{ method: string; params: unknown }> = [];
    const ctx = {
      notify: (method: string, params: unknown) => {
        notified.push({ method, params });
        return Promise.resolve();
      },
    };

    /* @When dispatched with a notification context */
    const response = await endpoint.dispatch(
      { executionId: "exec-1" } as Anyish,
      undefined,
      ctx,
    );

    /* @Then each event was pushed as an `execution.event` notification */
    assertEquals(response, {});
    assertEquals(notified.length, 2);
    assertEquals(notified[0].method, "execution.event");
    assertEquals(notified[0].params, { executionId: "exec-1", event: events[0] });
    assertEquals(notified[1].params, { executionId: "exec-1", event: events[1] });
  });

  it("drains the stream silently when dispatched WITHOUT a context (no crash)", async () => {
    /* @Given an operation with events but no notification context wired */
    const endpoint = new WatchEndpoint(executionsYielding([{ type: "log", line: "x" }]));
    /* @When dispatched with ctx omitted */
    const response = await endpoint.dispatch({ executionId: "exec-1" } as Anyish, undefined);
    /* @Then it still drains to completion and acks empty — events just dropped */
    assertEquals(response, {});
  });
});
