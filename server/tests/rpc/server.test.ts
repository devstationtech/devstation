import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import { Unauthenticated } from "@server/shared/authentication/domain/exceptions/unauthenticated.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import { ErrorCode } from "@server/shared/inbound/rpc/error/error-code.ts";
import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Success } from "@server/shared/inbound/rpc/envelope/response/success.ts";
import type { Failure } from "@server/shared/inbound/rpc/envelope/response/failure.ts";

import { ConfigureHandler } from "@server/auth/application/handlers/configure-handler.ts";
import { AuthenticateHandler } from "@server/auth/application/handlers/authenticate-handler.ts";
import { RenewHandler } from "@server/auth/application/handlers/renew-handler.ts";
import { ConfigureEndpoint } from "@server/auth/inbound/rpc/configure/endpoint.ts";
import { AuthenticateEndpoint } from "@server/auth/inbound/rpc/authenticate/endpoint.ts";
import { RenewEndpoint } from "@server/auth/inbound/rpc/renew/endpoint.ts";

import { testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

const stubAuthentication = {
  check: () => ({
    sessionId: "stub",
    key: "x".repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
  }),
};

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

describe("Server — dispatching auth endpoints", () => {
  let server: Server;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);

    server = new Server(
      EndpointRegistry.empty(stubAuthentication)
        .public(new ConfigureEndpoint(c.get(ConfigureHandler)))
        .public(new AuthenticateEndpoint(c.get(AuthenticateHandler)))
        .public(new RenewEndpoint(c.get(RenewHandler))),
      silentLogger,
      "test-core",
    );
  });

  afterEach(() => persistence.teardown());

  it("responds to rpc.version with protocol + core version", async () => {
    /* @Given a freshly assembled Server */
    /* @When  the client requests rpc.version */
    const req: Request = { jsonrpc: "2.0", id: 1, method: "rpc.version", params: {} };
    const res = await server.handle(req) as Success<{ protocol: string; core: string }>;

    /* @Then  the envelope echoes id and returns the protocol/core version */
    assertEquals(res.jsonrpc, "2.0");
    assertEquals(res.id, 1);
    assertEquals(res.result, { protocol: "1.0", core: "test-core" });
  });

  it("dispatches auth.configure → auth.authenticate → auth.renew end-to-end", async () => {
    /* @Given the auth context is empty */
    /* @When  the client configures, authenticates, then renews */
    const configured = await server.handle({
      jsonrpc: "2.0",
      id: "a",
      method: "auth.configure",
      params: { password: "rpc-poc-passphrase" },
    }) as Success<{ sessionId: string; expiresAt: string }>;

    const authenticated = await server.handle({
      jsonrpc: "2.0",
      id: "b",
      method: "auth.authenticate",
      params: { password: "rpc-poc-passphrase" },
    }) as Success<{ sessionId: string; expiresAt: string }>;

    const renewed = await server.handle({
      jsonrpc: "2.0",
      id: "c",
      method: "auth.renew",
      params: { sessionId: authenticated.result.sessionId },
    }) as Success<{ sessionId: string; expiresAt: string }>;

    /* @Then  each call returns a populated AuthSession */
    assertEquals(configured.result.sessionId.length, 36);
    assertEquals(authenticated.result.sessionId.length, 36);
    assertEquals(renewed.result.sessionId.length, 36);
    assertExists(new Date(renewed.result.expiresAt));
  });

  it("returns -32000 unauthenticated when renew receives an unknown sessionId", async () => {
    /* @Given the auth context is configured */
    await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "auth.configure",
      params: { password: "rpc-poc-passphrase" },
    });

    /* @When  the client renews with an unknown sessionId */
    const res = await server.handle({
      jsonrpc: "2.0",
      id: 2,
      method: "auth.renew",
      params: { sessionId: "00000000-0000-0000-0000-000000000000" },
    }) as Failure;

    /* @Then  the server maps the domain exception to JSON-RPC code -32000 */
    assertEquals(res.error.code, ErrorCode.UNAUTHENTICATED);
    assertEquals(res.error.message, "unauthenticated");
  });

  it("returns -32601 when the method is unknown", async () => {
    const res = await server.handle({
      jsonrpc: "2.0",
      id: 9,
      method: "cluster.register-proxmox",
      params: {},
    }) as Failure;

    assertEquals(res.error.code, ErrorCode.METHOD_NOT_FOUND);
  });

  it("returns -32600 for malformed envelopes", async () => {
    const res = await server.handle({ id: 1 } as unknown as Request) as Failure;
    assertEquals(res.error.code, ErrorCode.INVALID_REQUEST);
  });
});

describe("Server — error mapping", () => {
  it("maps Unauthenticated thrown by any endpoint to -32000", async () => {
    /* @Given a stub endpoint that throws Unauthenticated */
    class ThrowingEndpoint implements Endpoint<"auth.configure", { password: string }, never> {
      readonly method = "auth.configure" as const;
      dispatch(): never {
        throw new Unauthenticated();
      }
    }
    const server = new Server(
      EndpointRegistry.empty(stubAuthentication).public(new ThrowingEndpoint()),
      silentLogger,
      "test-core",
    );

    /* @When  the client invokes that method */
    const res = await server.handle({
      jsonrpc: "2.0",
      id: 7,
      method: "auth.configure",
      params: { password: "x" },
    }) as Failure;

    /* @Then  the envelope carries -32000 */
    assertEquals(res.error.code, ErrorCode.UNAUTHENTICATED);
  });
});
