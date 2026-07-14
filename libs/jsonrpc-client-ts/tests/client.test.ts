/**
 * Smoke for Client.invoke and the notification subscription seam.
 * The Channel is mocked so the test exercises the JSON-RPC envelope
 * shaping and error-mapping without spawning a subprocess.
 */
import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";

class EchoChannel implements Channel {
  last: Request | null = null;
  constructor(private readonly result: unknown) {}
  send(request: Request): Promise<Response> {
    this.last = request;
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: this.result });
  }
  onNotification(_: (n: Notification) => void): () => void {
    return () => {};
  }
}

class FailingChannel implements Channel {
  constructor(private readonly code: number, private readonly message: string) {}
  send(request: Request): Promise<Response> {
    return Promise.resolve({
      jsonrpc: "2.0",
      id: request.id,
      error: { code: this.code, message: this.message },
    });
  }
  onNotification(_: (n: Notification) => void): () => void {
    return () => {};
  }
}

class PushChannel implements Channel {
  private handlers = new Set<(n: Notification) => void>();
  send(request: Request): Promise<Response> {
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: {} });
  }
  onNotification(handler: (n: Notification) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
  push(method: string, params: unknown): void {
    for (const handler of this.handlers) {
      handler({ jsonrpc: "2.0", method, params });
    }
  }
}

describe("Client.invoke", () => {
  it("sends the method + params and returns the channel's result", async () => {
    /* @Given a client over a channel that echoes a fixed result */
    const channel = new EchoChannel({ ok: true, n: 42 });
    const client = new Client(channel);

    /* @When a method is invoked with params */
    const result = await client.invoke<{ ok: boolean; n: number }>("test.method", { foo: "bar" });

    /* @Then the request carries the method + params and the result is returned verbatim */
    assertEquals(channel.last?.method, "test.method");
    assertEquals(channel.last?.params, { foo: "bar" });
    assertEquals(result, { ok: true, n: 42 });
  });

  it("maps a JSON-RPC error response into an Exception", async () => {
    /* @Given a channel that always answers with a JSON-RPC error */
    const channel = new FailingChannel(ErrorCode.METHOD_NOT_FOUND, "not found");
    const client = new Client(channel);

    /* @When invoked @Then the error envelope surfaces as a rejected Exception */
    await assertRejects(
      () => client.invoke("missing.method", {}),
      Exception,
      "not found",
    );
  });
});

describe("Client.onNotification", () => {
  it("delivers notifications matching the method to the handler", () => {
    /* @Given a handler subscribed to one method over a push-capable channel */
    const channel = new PushChannel();
    const client = new Client(channel);

    const received: unknown[] = [];
    const unsubscribe = client.onNotification("event.x", (params) => received.push(params));

    /* @When notifications for the subscribed and other methods are pushed */
    channel.push("event.x", { value: 1 });
    channel.push("event.y", { value: 99 });
    channel.push("event.x", { value: 2 });

    /* @Then only the matching ones reach the handler, in order */
    assertEquals(received, [{ value: 1 }, { value: 2 }]);

    /* @And after unsubscribing no further notifications are delivered */
    unsubscribe();
    channel.push("event.x", { value: 3 });
    assertEquals(received.length, 2);
  });
});
