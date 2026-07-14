import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ExecutionListResponse } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { ExecutionEvent as DomainEvent } from "@server/shared/executions/domain/events/event.ts";
import {
  buildClient,
  streamingTask,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/shared/executions/fixtures/bootstrap.ts";

describe("operation.list endpoint — integration", () => {
  let rpc: Client;
  let operations: InMemoryExecutions;

  beforeEach(() => {
    const c = testContainer();
    operations = c.get(InMemoryExecutions);
    rpc = buildClient(c);
  });

  afterEach(() => {});

  it("should return an empty list when no operation has been started", async () => {
    /* @Given no operation has been started */
    /* @When the client invokes operation.list */
    const response = await rpc.invoke<ExecutionListResponse>("execution.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries an empty list */
    assertEquals(response, []);
  });

  it("should return every tracked operation", async () => {
    /* @Given two operations are running */
    const a = operations.start(streamingTask(async function* (): AsyncIterable<DomainEvent> {
      yield new Log("a");
    }));
    const b = operations.start(streamingTask(async function* (): AsyncIterable<DomainEvent> {
      yield new Log("b");
    }));

    /* @When the client invokes operation.list */
    const response = await rpc.invoke<ExecutionListResponse>("execution.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries both operations */
    const ids = response.map((r) => r.id).sort();
    assertEquals(ids, [a.id, b.id].sort());
  });
});
