import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProxmoxReadApiAdapterFactory } from "@server/cluster/application/queries/proxmox/api/factory-adapter.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { ProxmoxConnectionRecord } from "@server/cluster/application/queries/proxmox/records/connection-record.ts";

const connection: ProxmoxConnectionRecord = {
  host: "10.0.0.1",
  vaultId: "vault-1",
  secretId: "secret-1",
};

function makeResolver(token: string | null): SecretResolver {
  return { resolve: () => Promise.resolve(token) };
}

describe("ProxmoxReadApiAdapterFactory", () => {
  it("should return ProxmoxReadApi when token resolves", async () => {
    /* @Given a resolver that returns a valid token */
    const factory = new ProxmoxReadApiAdapterFactory(makeResolver("PVEAPIToken=user@pam!tok=abc"));

    /* @When create is called */
    const api = await factory.create(connection);

    /* @Then it should return a ProxmoxReadApi with the 4 methods */
    assertEquals(api !== null, true);
    assertEquals(typeof api!.liveNodes, "function");
    assertEquals(typeof api!.liveVirtualMachines, "function");
    assertEquals(typeof api!.storages, "function");
    assertEquals(typeof api!.vmMetrics, "function");
  });

  it("should return null when token cannot be resolved", async () => {
    /* @Given a resolver that returns null */
    const factory = new ProxmoxReadApiAdapterFactory(makeResolver(null));

    /* @When create is called */
    const api = await factory.create(connection);

    /* @Then it should return null */
    assertEquals(api, null);
  });
});
