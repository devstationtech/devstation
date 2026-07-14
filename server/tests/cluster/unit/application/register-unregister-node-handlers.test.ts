import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import { RegisterNode } from "@server/cluster/application/commands/proxmox/register-node.ts";
import { UnregisterNode } from "@server/cluster/application/commands/proxmox/unregister-node.ts";
import { NodeAlreadyExists } from "@server/cluster/domain/exceptions/node-already-exists.ts";
import { NodeNotFound } from "@server/cluster/domain/exceptions/node-not-found.ts";
import { NodeHasVirtualMachines } from "@server/cluster/domain/exceptions/node-has-virtual-machines.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { nodeImage, registerNode, virtualMachine } from "@tests/cluster/fixtures/operations.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * Register/UnregisterNode handlers pin the two distinctive cluster
 * invariants for nodes:
 *  - Register: name AND ip must be unique within the cluster (errors
 *    distinguish which one collided so the operator knows what to fix).
 *  - Unregister: a node with virtual machines cannot be removed
 *    (NodeHasVirtualMachines — must unregister VMs first); unknown id
 *    raises NodeNotFound.
 */

function fakeClustersWith(cluster: ProxmoxCluster): { clusters: Clusters } {
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

function aProxmoxCluster(): ProxmoxCluster {
  return ProxmoxCluster.register(
    new Id(),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

const VAULT = "00000000-0000-0000-0000-000000000010";
const USER_SECRET = "00000000-0000-0000-0000-000000000011";
const PW_SECRET = "00000000-0000-0000-0000-000000000012";

describe("RegisterNodeHandler — happy path", () => {
  it("registers a node with name + ip + credential on the cluster", async () => {
    /* @Given a cluster with no nodes */
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterNodeHandler(clusters);
    /* @When register runs */
    await handler.handle(
      new RegisterNode(cluster.id.value, "cp4", "192.168.15.194", VAULT, USER_SECRET, PW_SECRET),
    );
    /* @Then the cluster has the node */
    assertEquals(cluster.nodes.length, 1);
    assertEquals(cluster.nodes.items[0].name.value, "cp4");
    assertEquals(cluster.nodes.items[0].ip.value, "192.168.15.194");
  });
});

describe("RegisterNodeHandler — uniqueness", () => {
  it("rejects when the name already exists (NodeAlreadyExists carrying 'name')", async () => {
    /* @Given a cluster with a 'cp4' node */
    const cluster = aProxmoxCluster();
    cluster.registerNode(registerNode("cp4", "192.168.15.194"));
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterNodeHandler(clusters);
    /* @When register reuses the name (different ip) */
    /* @Then NodeAlreadyExists with the 'name' tag — operator knows it's the name */
    await assertRejects(
      () =>
        handler.handle(
          new RegisterNode(
            cluster.id.value,
            "cp4",
            "192.168.15.200",
            VAULT,
            USER_SECRET,
            PW_SECRET,
          ),
        ),
      NodeAlreadyExists,
      "name",
    );
    assertEquals(cluster.nodes.length, 1);
  });

  it("rejects when the ip already exists (NodeAlreadyExists carrying 'ip')", async () => {
    /* @Given a cluster with a node at 192.168.15.194 */
    const cluster = aProxmoxCluster();
    cluster.registerNode(registerNode("cp4", "192.168.15.194"));
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterNodeHandler(clusters);
    /* @When register reuses the IP under a different name */
    /* @Then NodeAlreadyExists tagged 'ip' */
    await assertRejects(
      () =>
        handler.handle(
          new RegisterNode(
            cluster.id.value,
            "cp5",
            "192.168.15.194",
            VAULT,
            USER_SECRET,
            PW_SECRET,
          ),
        ),
      NodeAlreadyExists,
      "ip",
    );
    assertEquals(cluster.nodes.length, 1);
  });
});

describe("UnregisterNodeHandler — happy path", () => {
  it("removes a node that has no virtual machines", async () => {
    /* @Given a cluster with one empty node */
    const cluster = aProxmoxCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UnregisterNodeHandler(clusters);
    /* @When unregister runs */
    await handler.handle(new UnregisterNode(cluster.id.value, node.id.value));
    /* @Then the node is gone */
    assertEquals(cluster.nodes.length, 0);
  });
});

describe("UnregisterNodeHandler — guards", () => {
  it("rejects unregistering a node with VMs (NodeHasVirtualMachines) and leaves the cluster intact", async () => {
    /* @Given a node with one VM attached */
    const cluster = aProxmoxCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.101"));
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UnregisterNodeHandler(clusters);
    /* @When unregister runs */
    /* @Then NodeHasVirtualMachines — must remove VMs first */
    await assertRejects(
      () => handler.handle(new UnregisterNode(cluster.id.value, node.id.value)),
      NodeHasVirtualMachines,
    );
    /* @And the node is still there */
    assertEquals(cluster.nodes.length, 1);
  });

  it("rejects unregistering an unknown node id (NodeNotFound)", async () => {
    /* @Given a cluster with one node */
    const cluster = aProxmoxCluster();
    cluster.registerNode(registerNode("cp4", "192.168.15.194"));
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UnregisterNodeHandler(clusters);
    /* @When unregister targets an unknown id */
    /* @Then NodeNotFound — same exception as the read side, predictable contract */
    await assertRejects(
      () =>
        handler.handle(
          new UnregisterNode(cluster.id.value, "00000000-0000-0000-0000-0000000000ff"),
        ),
      NodeNotFound,
    );
    assertEquals(cluster.nodes.length, 1);
  });
});
