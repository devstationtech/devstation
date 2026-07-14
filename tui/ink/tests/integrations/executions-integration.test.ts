import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import { ExecutionsIntegration } from "@ui/shared/integrations/executions-integration.ts";
import {
  ExecutionEventNotification,
  Log,
  Step,
  Succeeded,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { ExecutionEvent } from "@jsonrpc-contracts-ts/executions.gen.ts";

const EXEC_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_EXEC = "99999999-9999-9999-9999-999999999999";
const SESSION = "00000000-0000-0000-0000-000000000001";

/**
 * Mock channel: Acks `execution.watch` immediately (register-and-return)
 * and lets the test push `execution.event` notifications, JSON
 * round-tripped to mirror the stdio transport — the UI sees plain
 * objects, not class instances, so the integration must not rely on
 * `instanceof`.
 */
class FakeChannel implements Channel {
  private handler: ((n: Notification) => void) | null = null;

  send(request: Request): Promise<Response> {
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: {} });
  }

  onNotification(handler: (n: Notification) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  push(method: string, params: unknown): void {
    const wire = JSON.parse(JSON.stringify({ jsonrpc: "2.0", method, params }));
    this.handler?.(wire);
  }
}

describe("ExecutionsIntegration — UI consumes operation streams via wire", () => {
  it("yields execution.event params in order, ending on the Succeeded terminal", async () => {
    /* @Given a fresh integration wired to a fake wire channel */
    const channel = new FakeChannel();
    const integration = new ExecutionsIntegration(new Client(channel));

    /* @When the UI starts iterating and the wire emits a sequence */
    const collected: ExecutionEvent[] = [];
    const consumer = (async () => {
      for await (const event of integration.watch({ sessionId: SESSION, executionId: EXEC_ID })) {
        collected.push(event);
      }
    })();

    // Let the watch request register before pushing notifications.
    await Promise.resolve();
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Log("starting")));
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Step("plan")));
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Log("done")));
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Succeeded()));
    await consumer;

    /* @Then every wire event arrives in order, terminated by Succeeded */
    assertEquals(collected.length, 4);
    assertEquals(collected[0], { type: "log", line: "starting" });
    assertEquals(collected[1], { type: "step", name: "plan" });
    assertEquals(collected[2], { type: "log", line: "done" });
    assertEquals(collected[3].type, "succeeded");
  });

  it("filters out execution.event notifications for other executionIds", async () => {
    const channel = new FakeChannel();
    const integration = new ExecutionsIntegration(new Client(channel));

    const collected: ExecutionEvent[] = [];
    const consumer = (async () => {
      for await (const event of integration.watch({ sessionId: SESSION, executionId: EXEC_ID })) {
        collected.push(event);
      }
    })();

    await Promise.resolve();
    // Foreign exec — must be dropped.
    channel.push("execution.event", new ExecutionEventNotification(OTHER_EXEC, new Log("noise")));
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Log("ours")));
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Succeeded()));
    await consumer;

    assertEquals(collected.length, 2);
    assertEquals(collected[0], { type: "log", line: "ours" });
    assertEquals(collected[1].type, "succeeded");
  });

  it("lets the UI discriminate events with a switch on `type` (no instanceof)", async () => {
    const channel = new FakeChannel();
    const integration = new ExecutionsIntegration(new Client(channel));

    const logs: string[] = [];
    const steps: string[] = [];
    let terminal: string | null = null;
    const consumer = (async () => {
      for await (const event of integration.watch({ sessionId: SESSION, executionId: EXEC_ID })) {
        switch (event.type) {
          case "log":
            logs.push(event.line);
            break;
          case "step":
            steps.push(`${event.name}${event.detail ? `: ${event.detail}` : ""}`);
            break;
          case "succeeded":
          case "failed":
          case "cancelled":
            terminal = event.type;
            break;
        }
      }
    })();

    await Promise.resolve();
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Log("hello")));
    channel.push(
      "execution.event",
      new ExecutionEventNotification(EXEC_ID, new Step("validate", "checking inputs")),
    );
    channel.push("execution.event", new ExecutionEventNotification(EXEC_ID, new Succeeded()));
    await consumer;

    assertEquals(logs, ["hello"]);
    assertEquals(steps, ["validate: checking inputs"]);
    assertEquals(terminal, "succeeded");
  });
});
