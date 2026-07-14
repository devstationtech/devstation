import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { AuthConfigureResponse, AuthRenewResponse } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("auth.configure endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterEach(() => persistence.teardown());

  it("should return a session right after configuration", async () => {
    /* @Given an authentication context not yet configured */
    /* @When the client invokes configuration with a valid password */
    const response = await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });

    /* @Then the response carries a session identifier and a future expiration */
    assertEquals(response.sessionId.length, 36);
    assertEquals(new Date(response.expiresAt) > new Date(), true);
  });

  it("should persist credentials on disk after configuration", async () => {
    /* @Given an authentication context not yet configured */
    /* @When the client invokes configuration with a valid password */
    await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });

    /* @Then the credential files exist on disk */
    const saltExists = await Deno.stat(`${persistence.dir}/.salt`).then(() => true, () => false);
    const authExists = await Deno.stat(`${persistence.dir}/.auth`).then(() => true, () => false);
    assertEquals(saltExists, true);
    assertEquals(authExists, true);
  });

  it("should store the session so it can be renewed afterwards", async () => {
    /* @Given an authentication context just configured */
    const session = await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });

    /* @When the returned session is renewed */
    const renewed = await rpc.invoke<AuthRenewResponse>("auth.renew", {
      sessionId: session.sessionId,
    });

    /* @Then renewal returns the same session identifier */
    assertEquals(renewed.sessionId, session.sessionId);
  });

  it("should reject a new password shorter than the strong minimum", async () => {
    /* @Given an authentication context not yet configured */
    /* @When the client configures with a password under 16 characters */
    /* @Then the server replies with a failure signalling the weak password */
    await assertRejects(
      () =>
        rpc.invoke<AuthConfigureResponse>("auth.configure", {
          password: "only-12chars",
        }),
      Exception,
      "new passwords must be at least 16 characters.",
    );
  });
});
