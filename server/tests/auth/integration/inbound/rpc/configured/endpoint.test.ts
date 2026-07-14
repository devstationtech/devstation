import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  AuthConfiguredResponse,
  AuthConfigureResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("auth.configured endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterEach(() => persistence.teardown());

  it("should report false before the master password is configured", async () => {
    /* @Given an authentication context not yet configured */
    /* @When the client asks whether auth is configured */
    const configured = await rpc.invoke<AuthConfiguredResponse>("auth.configured", {});

    /* @Then it reports not configured */
    assertEquals(configured, false);
  });

  it("should report true after the master password is configured", async () => {
    /* @Given an authentication context configured with a password */
    await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });

    /* @When the client asks whether auth is configured */
    const configured = await rpc.invoke<AuthConfiguredResponse>("auth.configured", {});

    /* @Then it reports configured */
    assertEquals(configured, true);
  });
});
