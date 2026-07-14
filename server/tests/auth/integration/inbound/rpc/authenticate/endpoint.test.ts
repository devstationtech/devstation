import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  AuthAuthenticateResponse,
  AuthConfigureResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("auth.authenticate endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });
  });

  afterAll(() => persistence.teardown());

  it("should return a session when the password is correct", async () => {
    /* @Given authentication was configured with a known password */
    /* @When the client invokes authentication with the correct password */
    const response = await rpc.invoke<AuthAuthenticateResponse>("auth.authenticate", {
      password: "my-secure-password",
    });

    /* @Then the response carries a session identifier and a future expiration */
    assertEquals(response.sessionId.length, 36);
    assertEquals(new Date(response.expiresAt) > new Date(), true);
  });

  it("should reject authentication when the password does not match", async () => {
    /* @Given authentication was configured with a known password */
    /* @When the client invokes authentication with the wrong password */
    /* @Then the server replies with a failure signalling invalid authentication */
    await assertRejects(
      () =>
        rpc.invoke<AuthAuthenticateResponse>("auth.authenticate", {
          password: "wrong-password-123",
        }),
      Exception,
      "authentication failed",
    );
  });
});
