import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ExecutionCancelResponse } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { ExecutionEvent as DomainEvent } from "@server/shared/executions/domain/events/event.ts";
import {
  buildClient,
  streamingTask,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/shared/executions/fixtures/bootstrap.ts";

describe("operation.cancel endpoint — integration", () => {
  let rpc: Client;
  let operations: InMemoryExecutions;

  beforeEach(() => {
    const c = testContainer();
    operations = c.get(InMemoryExecutions);
    rpc = buildClient(c);
  });

  afterEach(() => {});

  it("should signal the operation's abort signal", async () => {
    /* @Given a running operation that observes its abort signal */
    const sleep = (ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          resolve();
        }, { once: true });
      });
    let aborted = false;
    const operation = operations.start(
      streamingTask(async function* (op): AsyncIterable<DomainEvent> {
        yield new Log("running");
        while (!op.signal.aborted) {
          await sleep(5, op.signal);
        }
        aborted = op.signal.aborted;
      }),
    );
    await new Promise((r) => setTimeout(r, 10));

    /* @When the client invokes operation.cancel */
    const response = await rpc.invoke<ExecutionCancelResponse>("execution.cancel", {
      sessionId: STUB_SESSION_ID,
      executionId: operation.id,
    });

    /* @Then the response is an empty ack */
    assertEquals(response, {});

    /* @And the operation's abort signal fires */
    await new Promise((r) => setTimeout(r, 10));
    assertEquals(aborted, true);
  });
});
