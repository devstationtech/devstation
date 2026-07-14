import { Container } from "@server/container.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { emitFrom } from "@server/shared/executions/outbound/streaming/emit-from.ts";
import {
  CancelEndpoint,
  ListEndpoint,
  WatchEndpoint,
} from "@server/shared/executions/inbound/rpc/endpoints.ts";

export const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
export const STUB_SESSION_KEY = "a".repeat(64);

export class StubAuthentication implements Authentication {
  check(_sessionId: string): AuthenticatedSession {
    return {
      sessionId: STUB_SESSION_ID,
      key: STUB_SESSION_KEY,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
}

/**
 * Adapts a producer still written as an event generator into the
 * push-based `Task` contract. Tests keep expressing a producer as a
 * linear `async function*`; the runtime still owns the terminal. A
 * generator that never yields and never returns models a wedged task
 * (drives the liveness-watchdog tests).
 */
export function streamingTask(
  events: (execution: Execution) => AsyncIterable<ExecutionEvent>,
): Task {
  return { run: (execution, emitter) => emitFrom(events(execution), emitter) };
}

export function testContainer(idleTimeoutMs?: number): Container {
  return new Container()
    .register(InMemoryExecutions, () => new InMemoryExecutions(idleTimeoutMs))
    .register(StubAuthentication, () => new StubAuthentication())
    .register(WatchEndpoint, (c) => new WatchEndpoint(c.get(InMemoryExecutions)))
    .register(CancelEndpoint, (c) => new CancelEndpoint(c.get(InMemoryExecutions)))
    .register(ListEndpoint, (c) => new ListEndpoint(c.get(InMemoryExecutions)))
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * In-process Channel implementation that bridges Client to Server.
 *
 * The Server.handle() call accepts a notification-sender callback; we wire
 * it to push notifications into the same set of handlers that
 * `onNotification(...)` registers — so the Client receives both
 * id-correlated responses AND server-initiated notifications without
 * spawning a subprocess.
 */
class InProcessChannel implements Channel {
  private readonly handlers = new Set<(n: Notification) => void>();

  constructor(private readonly server: Server) {}

  send(request: Request): Promise<Response> {
    // deno-lint-ignore require-await -- callback satisfies the async NotificationSender port
    return this.server.handle(request, async (n) => {
      // Mirror the subprocess transport: notifications cross stdio as
      // JSON, so the client receives plain objects (no class prototype).
      // Round-tripping here keeps the in-process test faithful to what
      // the UI actually observes in production.
      const wire = JSON.parse(JSON.stringify(n)) as Notification;
      for (const handler of this.handlers) handler(wire);
    });
  }

  onNotification(handler: (notification: Notification) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

/**
 * Builds an in-process Client wired to a Server with the operations
 * catalog registered. Integration tests use this to exercise the full
 * wire flow (request, response, server-initiated notifications) without
 * spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(WatchEndpoint))
      .protected(container.get(CancelEndpoint))
      .protected(container.get(ListEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client(new InProcessChannel(server));
}
