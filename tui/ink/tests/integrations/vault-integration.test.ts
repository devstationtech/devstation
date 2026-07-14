import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { VaultIntegration } from "@ui/shared/integrations/vault-integration.ts";

/**
 * VaultIntegration covers 9 protected RPCs. Tests pin each method
 * name + the body shape so a UI rename without a server-side rename
 * never ships silently. Mirrors the integration-test pattern.
 */

class RecordingChannel implements Channel {
  last: Request | null = null;
  constructor(private readonly result: unknown) {}
  send(request: Request): Promise<Response> {
    this.last = request;
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: this.result });
  }
  onNotification(): () => void {
    return () => {};
  }
}

describe("VaultIntegration — vault.* methods", () => {
  it("createVault() → vault.create", async () => {
    const channel = new RecordingChannel({ id: "v1" });
    const integration = new VaultIntegration(new Client(channel));
    await integration.createVault({
      sessionId: "s",
      name: "homelab-secrets",
      user: "alice",
      hostname: "workstation",
    });
    assertEquals(channel.last?.method, "vault.create");
    assertEquals((channel.last?.params as { name: string }).name, "homelab-secrets");
  });

  it("deleteVault() → vault.delete with the vaultId", async () => {
    const channel = new RecordingChannel({});
    const integration = new VaultIntegration(new Client(channel));
    await integration.deleteVault({ sessionId: "s", vaultId: "v1" });
    assertEquals(channel.last?.method, "vault.delete");
    assertEquals(channel.last?.params, { sessionId: "s", vaultId: "v1" });
  });

  it("listVaults() → vault.list and returns the records array", async () => {
    const records = [{ id: "v1", name: "n" }];
    const channel = new RecordingChannel(records);
    const integration = new VaultIntegration(new Client(channel));
    const got = await integration.listVaults({ sessionId: "s" });
    assertEquals(channel.last?.method, "vault.list");
    assertEquals(got.length, 1);
  });

  it("renameVault() → vault.rename with vaultId + name", async () => {
    const channel = new RecordingChannel({});
    const integration = new VaultIntegration(new Client(channel));
    await integration.renameVault({ sessionId: "s", vaultId: "v1", name: "tooling" });
    assertEquals(channel.last?.method, "vault.rename");
    assertEquals(channel.last?.params, { sessionId: "s", vaultId: "v1", name: "tooling" });
  });
});

describe("VaultIntegration — vault.secrets.* methods", () => {
  it("generateSecret() → vault.secrets.generate (forwards the value when given)", async () => {
    /* @Given a generate request with an explicit value */
    const channel = new RecordingChannel({ id: "sec-1" });
    const integration = new VaultIntegration(new Client(channel));
    await integration.generateSecret({
      sessionId: "s",
      vaultId: "v1",
      name: "k3s-token",
      user: "alice",
      hostname: "workstation",
      value: "explicit-secret",
    });
    /* @Then the method + body reach the wire (the server uses the session's key to encrypt) */
    assertEquals(channel.last?.method, "vault.secrets.generate");
    const params = channel.last?.params as { name: string; value: string };
    assertEquals(params.name, "k3s-token");
    assertEquals(params.value, "explicit-secret");
  });

  it("retrieveSecret() → vault.secrets.retrieve with vaultId + secretId", async () => {
    /* @Given a retrieve response with a plaintext value */
    const channel = new RecordingChannel({ value: "ok" });
    const integration = new VaultIntegration(new Client(channel));
    await integration.retrieveSecret({ sessionId: "s", vaultId: "v1", secretId: "sec-1" });
    assertEquals(channel.last?.method, "vault.secrets.retrieve");
    assertEquals(
      channel.last?.params,
      { sessionId: "s", vaultId: "v1", secretId: "sec-1" },
    );
  });

  it("deleteSecret() → vault.secrets.delete", async () => {
    const channel = new RecordingChannel({});
    const integration = new VaultIntegration(new Client(channel));
    await integration.deleteSecret({ sessionId: "s", vaultId: "v1", secretId: "sec-1" });
    assertEquals(channel.last?.method, "vault.secrets.delete");
  });

  it("renameSecret() → vault.secrets.rename with vaultId + secretId + name", async () => {
    const channel = new RecordingChannel({});
    const integration = new VaultIntegration(new Client(channel));
    await integration.renameSecret({
      sessionId: "s",
      vaultId: "v1",
      secretId: "sec-1",
      name: "everest-server-admin-password",
    });
    assertEquals(channel.last?.method, "vault.secrets.rename");
    assertEquals((channel.last?.params as { name: string }).name, "everest-server-admin-password");
  });
});
