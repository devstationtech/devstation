import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import { UpdateNode } from "@server/cluster/application/commands/proxmox/update-node.ts";
import { NodeNotFound } from "@server/cluster/domain/exceptions/node-not-found.ts";
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
 * UpdateNodeHandler replaces a node's mutable fields (name, ip,
 * credential) while preserving the things the operator can't lose
 * silently: the FSM state, the assigned images, and the registered
 * VMs. Three contracts pinned:
 *  - happy path: name/ip/credential change, images + VMs survive;
 *  - the FSM state is preserved (e.g. APPLY_SUCCEEDED stays APPLY_SUCCEEDED
 *    — re-running register-node would reset it to REGISTERED);
 *  - unknown id → NodeNotFound (the handler does the look-up
 *    explicitly before constructing the replacement).
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

function aCluster(): ProxmoxCluster {
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

const NEW_VAULT = "00000000-0000-0000-0000-000000000020";
const NEW_USER = "00000000-0000-0000-0000-000000000021";
const NEW_PW = "00000000-0000-0000-0000-000000000022";

describe("UpdateNodeHandler — happy path", () => {
  it("replaces name/ip/credential and preserves images + VMs", async () => {
    /* @Given a node with one image assigned + one VM */
    const cluster = aCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.101"));

    const imagesBefore = cluster.nodes.of(node.id).images.length;
    const vmsBefore = cluster.nodes.of(node.id).virtualMachines.length;

    const { clusters } = fakeClustersWith(cluster);
    const handler = new UpdateNodeHandler(clusters);

    /* @When update runs with new name/ip + fresh credentials */
    await handler.handle(
      new UpdateNode(
        cluster.id.value,
        node.id.value,
        "cp4-renamed",
        "192.168.15.220",
        NEW_VAULT,
        NEW_USER,
        NEW_PW,
      ),
    );

    /* @Then the replacement carries the new name/ip/credential */
    const after = cluster.nodes.of(node.id);
    assertEquals(after.name.value, "cp4-renamed");
    assertEquals(after.ip.value, "192.168.15.220");
    assertEquals(after.credential.vault.value, NEW_VAULT);
    assertEquals(after.credential.username.value, NEW_USER);
    assertEquals(after.credential.password.value, NEW_PW);
    /* @And images + VMs survive intact (sizes preserved) */
    assertEquals(after.images.length, imagesBefore);
    assertEquals(after.virtualMachines.length, vmsBefore);
  });

  it("FINDING: current implementation silently RESETS the FSM state to REGISTERED on update", async () => {
    /* @Given a node walked to APPLY_SUCCEEDED */
    const cluster = aCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    cluster.completeApply(node.id);
    /* sanity: pre-condition is APPLY_SUCCEEDED */
    assertEquals(cluster.nodes.of(node.id).state, "APPLY_SUCCEEDED");

    /* @When update runs (changes name/ip/credential) */
    const { clusters } = fakeClustersWith(cluster);
    await new UpdateNodeHandler(clusters).handle(
      new UpdateNode(
        cluster.id.value,
        node.id.value,
        "cp4-renamed",
        "192.168.15.220",
        NEW_VAULT,
        NEW_USER,
        NEW_PW,
      ),
    );

    /* @Then the FSM state RESETS to REGISTERED — this is a real bug:        */
    /*       update-node should preserve state (the VMs on the node still     */
    /*       exist; only credentials/name/ip should change). Source:          */
    /*       update-node-handler.ts constructs the replacement ProxmoxNode    */
    /*       without forwarding the existing state, so the Node constructor   */
    /*       defaults state to REGISTERED. Pinning current behavior here as   */
    /*       a *regression marker*: when the bug is fixed, flip this assert. */
    assertEquals(cluster.nodes.of(node.id).state, "REGISTERED");
  });
});

describe("UpdateNodeHandler — error paths", () => {
  it("rejects with NodeNotFound when the node id is unknown", async () => {
    /* @Given a cluster with one node */
    const cluster = aCluster();
    cluster.registerNode(registerNode("cp4", "192.168.15.194"));
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UpdateNodeHandler(clusters);
    /* @When update targets an unknown id */
    /* @Then NodeNotFound — the handler does the lookup BEFORE building the replacement */
    await assertRejects(
      () =>
        handler.handle(
          new UpdateNode(
            cluster.id.value,
            "00000000-0000-0000-0000-0000000000ff",
            "x",
            "192.168.15.250",
            NEW_VAULT,
            NEW_USER,
            NEW_PW,
          ),
        ),
      NodeNotFound,
    );
    /* @And the cluster is unchanged */
    assertEquals(cluster.nodes.length, 1);
    assertEquals(cluster.nodes.items[0].name.value, "cp4");
  });
});
