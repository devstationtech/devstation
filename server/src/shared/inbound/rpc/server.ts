import { installShutdownHandlers } from "@server/shared/platform/signals.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";
import type { Transport } from "@server/shared/inbound/rpc/transport/transport.ts";
import { StdioTransport } from "@server/shared/inbound/rpc/transport/stdio-transport.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Notification } from "@server/shared/inbound/rpc/envelope/notification.ts";
import { Success } from "@server/shared/inbound/rpc/envelope/response/success.ts";
import { Failure } from "@server/shared/inbound/rpc/envelope/response/failure.ts";
import { Protocol } from "@server/shared/inbound/rpc/protocol.ts";

/**
 * Callback supplied by callers of `handle()` that need server-initiated
 * notifications to flow back to the client. The default `serve()` loop
 * binds it to `transport.send(...)`; in-process callers (tests, the UI's
 * in-process bridge) supply their own wiring.
 */
export type NotificationSender = (
  notification: Notification<string, unknown>,
) => Promise<void>;

/**
 * Stateless JSON-RPC 2.0 server.
 *
 * Receives envelopes from a Transport, finds the Endpoint for the method via
 * the EndpointRegistry, dispatches with the raw JSON input, and maps
 * exceptions to Failure envelopes. The server itself is sessionless —
 * endpoints carry tokens in their input when they need them.
 *
 * Streaming endpoints push notifications back through a `DispatchContext`
 * derived from the optional `notify` callback passed to `handle()`. The
 * Notification envelope has no `id` (JSON-RPC 2.0 spec) and rides the
 * same channel as id-correlated requests/responses.
 */
export class Server {
  constructor(
    private readonly endpoints: EndpointRegistry,
    private readonly logger: Logger,
    private readonly core: string,
  ) {}

  async serve(transport: Transport): Promise<void> {
    for await (const request of transport.incoming) {
      const send: NotificationSender = (n) => transport.send(n);
      // Every request is dispatched concurrently. A serial loop would
      // park the whole server on any slow call — a streaming pump
      // (execution.watch, minutes) or a long mutating op would block
      // every other request (the UI going blind for stats/connection/
      // node-list; "register image" hanging behind a provisioning run).
      // Concurrency is safe: the Clusters and Stations adapters each
      // serialize their own file writes, so two concurrent requests
      // cannot tear or lose each other's persisted state. The stdio
      // transport serializes its own writes too, so concurrent responses
      // frame safely.
      void this.handle(request, send)
        .then((r) => transport.send(r))
        .catch(() => {});
    }
  }

  async handle(request: Request, notify?: NotificationSender): Promise<Response> {
    if (request?.jsonrpc !== "2.0" || request.method === undefined) {
      return Failure.invalidRequest(request?.id ?? null, "missing jsonrpc/method");
    }

    if (request.method === "rpc.version") {
      return Success.of(request.id, Protocol.handshake(this.core));
    }

    const endpoint = this.endpoints.find(request.method);
    if (!endpoint) return Failure.methodNotFound(request.id, request.method);

    const ctx: DispatchContext | undefined = notify
      ? { notify: (method, params) => notify(Notification.of(method, params)) }
      : undefined;

    await this.logger.info(`rpc:${request.method}`, "dispatching");
    try {
      const result = await endpoint.dispatch(request.params, ctx);
      return Success.of(request.id, result);
    } catch (error) {
      await this.logger.error(`rpc:${request.method}`, "failed", error);
      return Failure.fromException(request.id, error);
    }
  }
}

/**
 * Runs a composed `Server` over stdio — the RPC-framework run helper.
 * Wires the stdio transport + SIGINT/SIGTERM and serves. Symmetric
 * with `shared/inbound/mcp/server.ts`'s `serveStdio`: the composition
 * root (`src/rpc.ts`) builds the server; the entry (`src/rpc-server.ts`)
 * runs it through here.
 *
 * `banner` is written to stderr before serving — stdout is the
 * JSON-RPC channel and MUST stay clean.
 */
export async function serveStdio(server: Server, banner: string): Promise<void> {
  console.error(banner);

  installShutdownHandlers(() => Deno.exit(0));

  await server.serve(new StdioTransport(Deno.stdin.readable, Deno.stdout.writable));
}
