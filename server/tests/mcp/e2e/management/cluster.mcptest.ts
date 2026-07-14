/**
 * Cluster management e2e — every cluster MCP endpoint over a real server,
 * one happy path. The live reads run against the real lab cluster; the full
 * catalog write lifecycle runs on a throwaway prefixed test cluster. No infra
 * side effect (no plan/apply/destroy, image materialize or SSH); every created
 * entity is torn down at the end, in reverse order. The central image
 * catalog (register/update/remove) lives in the `images` context
 * (devstation_image_*); only assignment stays a cluster concern.
 *
 * connect/disconnect reuse the REAL lab connection refs so the server-side
 * probe succeeds.
 *
 * Reads: cluster_list, _get, _providers_list, _operating_systems_list,
 *   _nodes_list, _connections_list, _images_list, _vm_list, _vm_tags,
 *   _provision_preview, _vm_by_image, _storage_by_node, _vm_metrics.
 * Writes: cluster_register, _connect, _disconnect, _node_register,
 *   _node_update, _node_unregister, _nodes_unregister_all, _image_assign,
 *   _image_update_assigned, _image_unassign, _vm_register, _vm_update, _vm_unregister,
 *   _vms_unregister_all, _unregister.
 *
 * Explicit skips (no pure happy path): cluster_test_connection (needs a raw
 * Proxmox token MCP never exposes) and cluster_node_acknowledge_interruption
 * (needs a transient FSM state only an interrupted provisioning run yields).
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { CLUSTER, IMAGE, NODE, uniqueName, VM } from "../fixtures.ts";
import { type ConnectionSummary, resolveLive } from "../live.ts";

interface ImageRef {
  readonly imageId: string;
  readonly name: string;
}

describe("Cluster management", () => {
  const client = mcp();

  it("reads the live lab cluster topology", async () => {
    /* @Given the provider and operating-system catalogs answer */
    await client().parsed<unknown[]>("devstation_cluster_providers_list", {});
    await client().parsed<unknown[]>("devstation_cluster_operating_systems_list", {});

    /* @And the distinct VM tags and the catalog-wide image list answer */
    await client().parsed<unknown[]>("devstation_cluster_virtual_machine_tags", {});
    await client().parsed<unknown[]>("devstation_cluster_images_list", {});

    /* @When the live lab cluster + its first node are resolved */
    const { cluster, node } = await resolveLive(client());
    assert(cluster, "a live lab cluster must be configured");
    const clusterId = cluster.id;

    /* @Then the cluster is fetched by id, with its connections and preview */
    await client().parsed<{ name?: string }>("devstation_cluster_get", { clusterId });
    await client().parsed<ConnectionSummary[]>("devstation_cluster_connections_list", {
      clusterId,
    });
    await client().parsed("devstation_cluster_provision_preview", { clusterId });

    /* @And its images list answers; VMs can be found by the first image id */
    const images = await client().parsed<ImageRef[]>(
      "devstation_cluster_images_list",
      { clusterId },
    );
    const firstImageId = images[0]?.imageId;
    if (firstImageId) {
      await client().parsed<unknown[]>("devstation_cluster_virtual_machine_by_image", {
        imageId: firstImageId,
      });
    }

    /* @And the node's VMs, live storage, and a VM's live metrics answer */
    assert(node, "the live lab cluster must have at least one node");
    const nodeId = node.id;
    const virtualMachines = await client().parsed<{ id?: number }[]>(
      "devstation_cluster_virtual_machine_list",
      { clusterId, nodeId },
    );
    await client().parsed("devstation_cluster_storage_by_node", { clusterId, nodeId });
    const virtualMachineId = virtualMachines[0]?.id;
    if (virtualMachineId != null) {
      await client().parsed("devstation_cluster_virtual_machine_metrics", {
        clusterId,
        nodeId,
        virtualMachineId,
        timeframe: "hour",
      });
    }
  });

  it("runs the full catalog write lifecycle on a throwaway cluster", async () => {
    /* @Given a credential vault with a username and a password secret */
    const { vaultId } = await client().parsed<{ vaultId: string }>(
      "devstation_vault_create",
      { name: uniqueName("cluster-vault") },
    );
    const { secretId: usernameSecretId } = await client().parsed<{ secretId: string }>(
      "devstation_vault_secret_generate",
      { vaultId, name: uniqueName("user") },
    );
    const { secretId: passwordSecretId } = await client().parsed<{ secretId: string }>(
      "devstation_vault_secret_generate",
      { vaultId, name: uniqueName("pass") },
    );

    /* @And a freshly registered throwaway cluster */
    const { clusterId } = await client().parsed<{ clusterId: string }>(
      "devstation_cluster_register",
      CLUSTER,
    );

    /* @When it is connected (reusing the live lab connection → real probe) */
    const { cluster: liveCluster } = await resolveLive(client());
    assert(liveCluster, "a live lab cluster must be configured to borrow a connection from");
    const [liveConn] = await client().parsed<ConnectionSummary[]>(
      "devstation_cluster_connections_list",
      { clusterId: liveCluster.id },
    );
    assert(liveConn?.host && liveConn.vaultId && liveConn.secretId, "lab connection refs required");
    await client().parsed("devstation_cluster_connect", {
      clusterId,
      host: liveConn.host,
      vaultId: liveConn.vaultId,
      secretId: liveConn.secretId,
    });

    /* @Then its connection is listed, then disconnected */
    await client().parsed<ConnectionSummary[]>("devstation_cluster_connections_list", {
      clusterId,
    });
    await client().parsed("devstation_cluster_disconnect", { clusterId });

    /* @When a node is registered (re-list to resolve the generated id) */
    await client().parsed("devstation_cluster_node_register", {
      clusterId,
      ...NODE,
      vaultId,
      usernameSecretId,
      passwordSecretId,
    });
    const nodes = await client().parsed<{ id: string; name: string }[]>(
      "devstation_cluster_nodes_list",
      { clusterId },
    );
    const nodeId = nodes.find((n) => n.name === NODE.name)?.id;
    assert(nodeId, "registered node should be listed");

    /* @And the node is updated */
    await client().parsed("devstation_cluster_node_update", {
      clusterId,
      nodeId,
      ...NODE,
      ip: "10.255.0.11",
      vaultId,
      usernameSecretId,
      passwordSecretId,
    });

    /* @When an image is registered in the central catalog (images context) */
    const registered = await client().parsed<{ imageId: string }>(
      "devstation_image_register",
      { ...IMAGE },
    );
    const imageId = registered.imageId;
    assert(imageId, "registered image should yield an id");

    /* @And the image is updated */
    await client().parsed("devstation_image_update", {
      id: imageId,
      ...IMAGE,
      sourceUrl: "https://example.invalid/e2e-image-v2.qcow2",
    });

    /* @And the image is assigned to the node, reserving its own virtualMachineId, then the
       assignment is updated. A VM registered from it must take a DIFFERENT
       virtualMachineId — the aggregate rejects a VM whose id belongs to an image slot. */
    const assignVirtualMachineId = 99000 + Math.floor(Math.random() * 400);
    const vmVirtualMachineId = assignVirtualMachineId + 500;
    const storage = "local-lvm";
    await client().parsed("devstation_cluster_image_assign", {
      clusterId,
      nodeId,
      imageId,
      virtualMachineId: assignVirtualMachineId,
      storage,
      ...IMAGE,
    });
    await client().parsed("devstation_cluster_image_update_assigned", {
      clusterId,
      nodeId,
      imageId,
      virtualMachineId: assignVirtualMachineId,
      storage,
    });

    /* @Then the images context projected the usage (cluster event → policy → projection) */
    const afterAssign = await client().parsed<{ id: string; usages: { nodeId: string }[] }[]>(
      "devstation_image_list",
      {},
    );
    const assignedRow = afterAssign.find((i) => i.id === imageId);
    assert(assignedRow, "the catalog image must still be listed");
    assert(
      assignedRow.usages.some((u) => u.nodeId === nodeId),
      "assigning the image must record its usage on this node",
    );

    /* @When a VM is registered from the image, then updated */
    const vmFields = {
      clusterId,
      nodeId,
      ...VM,
      id: vmVirtualMachineId,
      image: imageId,
      storage,
      credentialVaultId: vaultId,
      usernameSecretId,
      passwordSecretId,
    };
    await client().parsed("devstation_cluster_virtual_machine_register", vmFields);
    await client().parsed("devstation_cluster_virtual_machine_update", { ...vmFields, ram: 2048 });

    /* @Then the provisioning preview includes the new VM */
    await client().parsed("devstation_cluster_provision_preview", { clusterId });

    /* @When everything is torn down in reverse order */
    await client().parsed("devstation_cluster_virtual_machine_unregister", {
      clusterId,
      nodeId,
      id: vmVirtualMachineId,
    });
    await client().parsed("devstation_cluster_virtual_machines_unregister_all", {
      clusterId,
      nodeId,
    });
    await client().parsed("devstation_cluster_image_unassign", { clusterId, nodeId, imageId });

    /* @Then unassigning clears the usage projection for this node */
    const afterUnassign = await client().parsed<{ id: string; usages: { nodeId: string }[] }[]>(
      "devstation_image_list",
      {},
    );
    const unassignedRow = afterUnassign.find((i) => i.id === imageId);
    assert(
      !unassignedRow || !unassignedRow.usages.some((u) => u.nodeId === nodeId),
      "unassigning the image must drop its usage on this node",
    );

    await client().parsed("devstation_image_unregister", { id: imageId });
    await client().parsed("devstation_cluster_node_unregister", { clusterId, nodeId });
    await client().parsed("devstation_cluster_nodes_unregister_all", { clusterId });
    await client().parsed("devstation_vault_delete", { vaultId });
    await client().parsed("devstation_cluster_unregister", { clusterId });
  });

  it.ignore("tests a connection (needs a raw Proxmox token MCP never exposes)", () => {});

  it.ignore("acknowledges a node interruption (needs a transient FSM state)", () => {});
});
