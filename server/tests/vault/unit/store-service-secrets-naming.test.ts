import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StoreServiceSecretsWhenServiceInstallSucceeded } from "@server/vault/inbound/policies/store-service-secrets-when-service-install-succeeded.ts";
import { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";
import { Id } from "@server/station/domain/models/service/id.ts";
import { Name } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Installation } from "@server/station/domain/models/service/installation.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import type { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";

/**
 * Regression: published secrets were keyed by the service's UUID
 * (`<serviceId>-<role>-<secret>`), producing opaque vault entries like
 * `e9d1a91c-…-server-admin-password` with no hint of which service they belong
 * to. They are now keyed by the service NAME — unique within a station's vault
 * and human-readable (`jenkins-main-admin-password`).
 */

function captureHandler(): { handler: GenerateSecretHandler; commands: GenerateSecret[] } {
  const commands: GenerateSecret[] = [];
  const handler = {
    handle: (command: GenerateSecret) => {
      commands.push(command);
      return Promise.resolve({ secretId: "sid" });
    },
  } as unknown as GenerateSecretHandler;
  return { handler, commands };
}

const session: SessionResolver = { resolve: () => "k".repeat(64) } as unknown as SessionResolver;

function event(
  serviceName: string,
  roleName: string,
  secrets: Record<string, string>,
  blueprintName = "jenkins",
) {
  const installation = new Installation(
    new Role(roleName),
    "10.0.0.1",
    new InstallResult({ version: "1.0.0" }, secrets, {}),
    Instant.fromString("2026-01-01T00:00:00.000Z"),
  );
  return new ServiceInstallSucceeded(
    new Id(),
    new Name(serviceName),
    new BlueprintName(blueprintName),
    new Vault(),
    [installation],
  );
}

describe("StoreServiceSecretsWhenServiceInstallSucceeded — naming", () => {
  it("keys a published secret by <service>-<role>-<secret>, not the service UUID", async () => {
    /* @Given a jenkins install that published adminPassword on the main role */
    const { handler, commands } = captureHandler();
    const policy = new StoreServiceSecretsWhenServiceInstallSucceeded(handler, session);

    /* @When the policy stores it */
    await policy.on(event("jenkins", "main", { adminPassword: "s3cr3t" }));

    /* @Then the vault key is human-readable and UUID-free */
    assertEquals(commands.length, 1);
    assertEquals(commands[0].name, "jenkins-main-admin-password");
  });

  it("slugifies camelCase / punctuated secret names", async () => {
    const { handler, commands } = captureHandler();
    const policy = new StoreServiceSecretsWhenServiceInstallSucceeded(handler, session);
    await policy.on(event("k3s-apps", "server", { k3sToken: "t" }, "k3s"));
    assertEquals(commands[0].name, "k3s-apps-server-k3s-token");
  });
});
