import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import { DisconnectCluster } from "@server/cluster/application/commands/proxmox/disconnect-cluster.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { connection } from "@tests/cluster/fixtures/operations.ts";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * DisconnectClusterHandler clears the Proxmox connection on the
 * cluster. Mirrors ConnectClusterHandler's provider guard — a
 * non-Proxmox cluster is refused (defensive — future providers can't
 * have their connection silently wiped by a Proxmox UI action).
 */

function fakeClustersWith(cluster: Cluster): { clusters: Clusters } {
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    of: () => Promise.resolve(cluster),
    update: async <T>(_id: unknown, change: (c: T) => unknown) => {
      await change(cluster as unknown as T);
      return cluster;
    },
    add: () => Promise.reject(new Error("not used")),
    remove: () => Promise.reject(new Error("not used")),
    exists: () => Promise.resolve(true),
    byName: () => Promise.resolve(null),
    all: () => Promise.resolve([cluster]),
  };
  return { clusters: stub as Clusters };
}

function aConnectedProxmoxCluster(): ProxmoxCluster {
  const cluster = ProxmoxCluster.register(
    new Id(),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
  cluster.connect(connection("proxmox.example.com"));
  return cluster;
}

describe("DisconnectClusterHandler — happy path", () => {
  it("clears an existing Proxmox connection (cluster.connection becomes undefined)", async () => {
    /* @Given a Proxmox cluster with a connection */
    const cluster = aConnectedProxmoxCluster();
    /* sanity: precondition is connected */
    assertEquals(cluster.connection?.host.value, "proxmox.example.com");
    /* @When disconnect runs */
    const { clusters } = fakeClustersWith(cluster);
    await new DisconnectClusterHandler(clusters).handle(
      new DisconnectCluster(cluster.id.value),
    );
    /* @Then the connection is gone */
    assertEquals(cluster.connection, undefined);
  });

  it("is idempotent — disconnecting a cluster that already has no connection is a no-op", async () => {
    /* @Given a Proxmox cluster without a connection */
    const cluster = ProxmoxCluster.register(
      new Id(),
      new Name("homelab"),
      new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    );
    /* @When disconnect runs */
    const { clusters } = fakeClustersWith(cluster);
    await new DisconnectClusterHandler(clusters).handle(
      new DisconnectCluster(cluster.id.value),
    );
    /* @Then no error and connection stays undefined */
    assertEquals(cluster.connection, undefined);
  });
});

describe("DisconnectClusterHandler — provider guard", () => {
  it("refuses to disconnect a non-Proxmox cluster (defensive — future providers protected)", async () => {
    /* @Given a non-Proxmox cluster passing through the update() callback */
    // deno-lint-ignore no-explicit-any
    const fakeNonProxmox: any = {
      id: new Id(),
      name: new Name("homelab"),
      provider: "vmware",
      events: { pull: () => [], size: 0 },
      version: { value: 1 },
    };
    const { clusters } = fakeClustersWith(fakeNonProxmox);
    const handler = new DisconnectClusterHandler(clusters);
    /* @When disconnect runs */
    /* @Then it throws with the exact phrase 'is not a proxmox cluster' */
    await assertRejects(
      () => handler.handle(new DisconnectCluster(fakeNonProxmox.id.value)),
      Error,
      "not a proxmox cluster",
    );
  });
});
