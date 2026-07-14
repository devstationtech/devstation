import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SecretResolverAdapter } from "@server/shared/secrets/outbound/secret-resolver-adapter.ts";
import type { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import type { RetrieveSecret } from "@server/vault/application/commands/retrieve-secret.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

const session: SessionResolver = { resolve: () => "x".repeat(64) };

function makeHandler(result: string | null): RetrieveSecretHandler {
  return {
    handle: (_command: RetrieveSecret) => Promise.resolve(result),
  } as RetrieveSecretHandler;
}

describe("SecretResolverAdapter", () => {
  it("should resolve a secret via RetrieveSecretHandler", async () => {
    /* @Given a handler that returns a valid token */
    const resolver = new SecretResolverAdapter(makeHandler("my-secret-token"), session);

    /* @When resolve is called */
    const result = await resolver.resolve(new Vault("v"), new Secret("s"));

    /* @Then it should return the token */
    assertEquals(result, "my-secret-token");
  });

  it("should return null when the handler returns null", async () => {
    /* @Given a handler that returns null */
    const resolver = new SecretResolverAdapter(makeHandler(null), session);

    /* @When resolve is called */
    const result = await resolver.resolve(new Vault("v"), new Secret("s"));

    /* @Then it should return null */
    assertEquals(result, null);
  });

  it("should forward vaultId, secretId and the session key to the handler", async () => {
    /* @Given a handler that captures the command */
    let captured: RetrieveSecret | null = null;
    const handler = {
      handle: (cmd: RetrieveSecret) => {
        captured = cmd;
        return Promise.resolve("token");
      },
    } as RetrieveSecretHandler;
    const resolver = new SecretResolverAdapter(handler, session);

    /* @When resolve is called with a vault and a secret */
    await resolver.resolve(new Vault("vault-abc"), new Secret("secret-xyz"));

    /* @Then the handler should receive a fully-built command */
    assertEquals(captured!.vaultId, "vault-abc");
    assertEquals(captured!.secretId, "secret-xyz");
    assertEquals(captured!.key.length, 64);
  });
});
