import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ExecutionEvent,
  ExecutionEventNotification,
  ExecutionWatchResponse,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Step } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { ExecutionEvent as DomainEvent } from "@server/shared/executions/domain/events/event.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import {
  buildClient,
  streamingTask,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/shared/executions/fixtures/bootstrap.ts";

describe("operation.watch endpoint — integration", () => {
  let rpc: Client;
  let operations: InMemoryExecutions;

  beforeEach(() => {
    const c = testContainer();
    operations = c.get(InMemoryExecutions);
    rpc = buildClient(c);
  });

  afterEach(() => {
    // no persistence to teardown
  });

  it("should stream events as notifications and resolve with empty ack", async () => {
    /* @Given an operation that emits a log, a step, and completes */
    const operation: Execution = operations.start(
      streamingTask(async function* (_op): AsyncIterable<DomainEvent> {
        yield new Log("starting");
        yield new Step("plan", "building plan");
        yield new Log("finished planning");
      }),
    );

    /* @And a client subscribed to operation.event notifications */
    const received: ExecutionEvent[] = [];
    rpc.onNotification<ExecutionEventNotification>("execution.event", (params) => {
      if (params.executionId === operation.id) received.push(params.event);
    });

    /* @When the client invokes operation.watch */
    const response = await rpc.invoke<ExecutionWatchResponse>("execution.watch", {
      sessionId: STUB_SESSION_ID,
      executionId: operation.id,
    });

    /* @Then the response is an empty ack */
    assertEquals(response, {});

    /* @And the events arrived in order as notifications, terminated by Succeeded */
    assertEquals(received.length, 4);
    assertEquals(received[0], { type: "log", line: "starting" });
    assertEquals(received[1], { type: "step", name: "plan", detail: "building plan" });
    assertEquals(received[2], { type: "log", line: "finished planning" });
    assertEquals(received[3], { type: "succeeded" });
  });

  it("should emit a cancelled terminal when the operation is cancelled mid-run", async () => {
    /* @Given a long-running operation */
    const sleep = (ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          resolve();
        }, { once: true });
      });
    const operation: Execution = operations.start(
      streamingTask(async function* (op): AsyncIterable<DomainEvent> {
        yield new Log("starting");
        while (!op.signal.aborted) {
          await sleep(5, op.signal);
          if (op.signal.aborted) break;
          yield new Log("still alive");
        }
      }),
    );

    /* @And a client subscribed to its events */
    const received: ExecutionEvent[] = [];
    rpc.onNotification<ExecutionEventNotification>("execution.event", (params) => {
      if (params.executionId === operation.id) received.push(params.event);
    });

    /* @When the client cancels the operation while watching */
    const watch = rpc.invoke<ExecutionWatchResponse>("execution.watch", {
      sessionId: STUB_SESSION_ID,
      executionId: operation.id,
    });
    await new Promise((r) => setTimeout(r, 10));
    await operations.cancel(operation.id);
    await watch;

    /* @Then the stream concludes with the cancelled terminal */
    assertEquals(received[received.length - 1], { type: "cancelled" });
  });
});
