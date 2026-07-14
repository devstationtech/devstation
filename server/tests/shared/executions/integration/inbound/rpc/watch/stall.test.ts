import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ExecutionEvent,
  ExecutionEventNotification,
  ExecutionWatchResponse,
  Failed,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import type { ExecutionEvent as DomainEvent } from "@server/shared/executions/domain/events/event.ts";
import {
  buildClient,
  streamingTask,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/shared/executions/fixtures/bootstrap.ts";

/**
 * End-to-end guarantee through the real `execution.watch` endpoint
 * (Server + Client + notification channel, faithful to the subprocess
 * transport per the fixture). A wedged task (awaiting a
 * subscriber/dispatch that never resolves) used to hang the watcher
 * forever. The watch must now resolve and deliver a terminal.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error("execution.watch hung — stall guard tripped")), ms);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(t)) as Promise<T>;
}

describe("operation.watch — stalled execution", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  it("delivers a Failed terminal and resolves the watch when the task wedges", async () => {
    const c = testContainer(60); // 60ms idle timeout
    const operations = c.get(InMemoryExecutions);
    const rpc: Client = buildClient(c);

    /* @Given a task that never yields and never settles */
    const operation = operations.start(
      // deno-lint-ignore require-yield -- stub generator intentionally never yields
      streamingTask(async function* (): AsyncIterable<DomainEvent> {
        await new Promise<never>(() => {});
      }),
    );

    const received: ExecutionEvent[] = [];
    rpc.onNotification<ExecutionEventNotification>("execution.event", (p) => {
      if (p.executionId === operation.id) received.push(p.event);
    });

    /* @When the client watches it over the real endpoint */
    const response = await withTimeout(
      rpc.invoke<ExecutionWatchResponse>("execution.watch", {
        sessionId: STUB_SESSION_ID,
        executionId: operation.id,
      }),
      4000,
    );

    /* @Then the watch resolves (no hang) and the stream ended on a
       Failed terminal explaining the stall */
    assertEquals(response, {});
    assertEquals(received.length, 1);
    assertEquals(received[0].type, "failed");
    assertStringIncludes((received[0] as Failed).error, "stalled");
  });
});
