import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { AuthConfigureResponse, AuthRenewResponse } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("auth.renew endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let session: AuthConfigureResponse;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    session = await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });
  });

  afterAll(() => persistence.teardown());

  it("should renew the session keeping the same identifier", async () => {
    /* @Given an active session */
    /* @When the client invokes renewal with the session identifier */
    const renewed = await rpc.invoke<AuthRenewResponse>("auth.renew", {
      sessionId: session.sessionId,
    });

    /* @Then the returned identifier matches the original session */
    assertEquals(renewed.sessionId, session.sessionId);
  });

  it("should return a future expiration after renewal", async () => {
    /* @Given an active session */
    /* @When the client invokes renewal with the session identifier */
    const renewed = await rpc.invoke<AuthRenewResponse>("auth.renew", {
      sessionId: session.sessionId,
    });

    /* @Then the returned expiration is a future date */
    assertEquals(new Date(renewed.expiresAt) > new Date(), true);
  });

  it("should reject renewal when the session is unknown", async () => {
    /* @Given a nonexistent session identifier */
    /* @When the client invokes renewal */
    /* @Then the server replies with the unauthenticated error code */
    const error = await assertRejects(
      () =>
        rpc.invoke<AuthRenewResponse>("auth.renew", {
          sessionId: "00000000-0000-0000-0000-000000000000",
        }),
      Exception,
    );
    assertEquals(error.code, ErrorCode.UNAUTHENTICATED);
    assertEquals(error.isUnauthenticated(), true);
  });
});
