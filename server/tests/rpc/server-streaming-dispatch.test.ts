import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import type { Authentication } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";
import type { Transport } from "@server/shared/inbound/rpc/transport/transport.ts";

/**
 * `Server.serve()` dispatches EVERY request concurrently. A serial
 * loop parks the whole server on any slow call — a streaming pump
 * (minutes) or a long mutating op blocks every other request. Safe
 * because the Clusters/Stations adapters serialize their own writes,
 * so concurrent requests can't tear or lose persisted state.
 */
const silentLogger: Logger = { info: async () => {}, warn: async () => {}, error: async () => {} };
const stubAuth = {
  check: () => {
    throw new Error("unused");
  },
} as unknown as Authentication;

const req = (id: number, method: string): Request =>
  ({ jsonrpc: "2.0", id, method, params: {} }) as unknown as Request;

describe("Server.serve — streaming dispatch", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  it("serves a later request before a slow streaming one completes", async () => {
    /* @Given a slow streaming endpoint and a fast one, requested in that order */
    const slowMs = 120;
    const registry = EndpointRegistry.empty(stubAuth)
      .public({
        method: "slow.stream",
        streaming: true,
        dispatch: () => new Promise((r) => setTimeout(() => r({ done: true }), slowMs)),
      })
      .public({ method: "fast.ping", dispatch: () => ({ pong: true }) });
    const server = new Server(registry, silentLogger, "test");

    const sent: Response[] = [];
    const transport: Transport = {
      incoming: (async function* () {
        yield req(1, "slow.stream");
        yield req(2, "fast.ping");
      })(),
      send: (m) => {
        sent.push(m as Response);
        return Promise.resolve();
      },
    };

    /* @When the server serves both concurrently */
    await server.serve(transport);
    // serve() returns once `incoming` ends; the streaming dispatch is
    // still pending in the background. Wait for both responses.
    await new Promise((r) => setTimeout(r, slowMs + 80));

    /* @Then fast.ping (id 2) is answered before the slow stream (id 1) */
    // fast.ping (id 2) must be answered before the slow streaming
    // endpoint (id 1) — proving it was not parked behind it.
    assertEquals(sent.map((s) => (s as { id: number }).id), [2, 1]);
  });

  it("serves a later request before a slow MUTATING one completes", async () => {
    /* @Given a slow non-streaming mutating endpoint and a fast one, in that order */
    const slowMs = 120;
    const registry = EndpointRegistry.empty(stubAuth)
      .public({
        // not streaming — a long mutating op (e.g. provisioning kickoff)
        method: "slow.mutate",
        dispatch: () => new Promise((r) => setTimeout(() => r({ ok: true }), slowMs)),
      })
      .public({ method: "fast.ping", dispatch: () => ({ pong: true }) });
    const server = new Server(registry, silentLogger, "test");

    const sent: Response[] = [];
    const transport: Transport = {
      incoming: (async function* () {
        yield req(1, "slow.mutate");
        yield req(2, "fast.ping");
      })(),
      send: (m) => {
        sent.push(m as Response);
        return Promise.resolve();
      },
    };

    /* @When the server serves both concurrently */
    await server.serve(transport);
    await new Promise((r) => setTimeout(r, slowMs + 80));

    /* @Then fast.ping (id 2) is answered before the slow mutate (id 1) — no head-of-line blocking */
    // fast.ping (id 2) answered before the slow mutating call (id 1):
    // mutating requests are no longer head-of-line blocked.
    assertEquals(sent.map((s) => (s as { id: number }).id), [2, 1]);
  });
});
