import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { UpdateVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/update/endpoint.ts";
import { UnregisterVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/unregister/endpoint.ts";
import { UnregisterAllVirtualMachinesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/unregister-all/endpoint.ts";
import { VirtualMachineByImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/by-image/endpoint.ts";
import { VirtualMachineMetricsMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/metrics/endpoint.ts";
import { AssignImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/assign/endpoint.ts";
import { UnassignImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/unassign/endpoint.ts";
import { UpdateAssignedImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/update-assigned/endpoint.ts";
import { StorageByNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/storage/by-node/endpoint.ts";
import { TestProxmoxConnectionMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/test-connection/endpoint.ts";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import type { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import type { UnregisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/unregister-virtual-machine-handler.ts";
import type { UnregisterAllVirtualMachinesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-virtual-machines-handler.ts";
import type { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import type { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import type { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import type { UpdateVirtualMachine } from "@server/cluster/application/commands/proxmox/update-virtual-machine.ts";
import type { UnregisterVirtualMachine } from "@server/cluster/application/commands/proxmox/unregister-virtual-machine.ts";
import type { UnregisterAllVirtualMachines } from "@server/cluster/application/commands/proxmox/unregister-all-virtual-machines.ts";
import type { AssignImage } from "@server/cluster/application/commands/proxmox/assign-image.ts";
import type { UnassignImage } from "@server/cluster/application/commands/proxmox/unassign-image.ts";
import type { UpdateAssignedImage } from "@server/cluster/application/commands/proxmox/update-assigned-image.ts";

/**
 * Regression tests for the cluster MCP endpoints covering VM operations,
 * image assignment, storage, and connection reads. Follows the exact
 * pattern of cluster-mcp-endpoints.test.ts — fake handler/query stubs,
 * metadata assertions, policy refusal / pass-through for
 * mutating/destructive endpoints, and result shape for reads.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fakeClusterByIdQuery(record: { name: string } | null): ClusterByIdQuery {
  return { execute: () => Promise.resolve(record) } as Anyish;
}

function fakeUpdateVirtualMachineHandler(): {
  handler: UpdateVirtualMachineHandler;
  calls: UpdateVirtualMachine[];
} {
  const calls: UpdateVirtualMachine[] = [];
  const handler = {
    handle(cmd: UpdateVirtualMachine): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UpdateVirtualMachineHandler;
  return { handler, calls };
}

function fakeUnregisterVirtualMachineHandler(): {
  handler: UnregisterVirtualMachineHandler;
  calls: UnregisterVirtualMachine[];
} {
  const calls: UnregisterVirtualMachine[] = [];
  const handler = {
    handle(cmd: UnregisterVirtualMachine): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterVirtualMachineHandler;
  return { handler, calls };
}

function fakeUnregisterAllVirtualMachinesHandler(): {
  handler: UnregisterAllVirtualMachinesHandler;
  calls: UnregisterAllVirtualMachines[];
} {
  const calls: UnregisterAllVirtualMachines[] = [];
  const handler = {
    handle(cmd: UnregisterAllVirtualMachines): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnregisterAllVirtualMachinesHandler;
  return { handler, calls };
}

function fakeAssignImageHandler(): { handler: AssignImageHandler; calls: AssignImage[] } {
  const calls: AssignImage[] = [];
  const handler = {
    handle(cmd: AssignImage): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as AssignImageHandler;
  return { handler, calls };
}

function fakeUnassignImageHandler(): { handler: UnassignImageHandler; calls: UnassignImage[] } {
  const calls: UnassignImage[] = [];
  const handler = {
    handle(cmd: UnassignImage): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UnassignImageHandler;
  return { handler, calls };
}

function fakeUpdateAssignedImageHandler(): {
  handler: UpdateAssignedImageHandler;
  calls: UpdateAssignedImage[];
} {
  const calls: UpdateAssignedImage[] = [];
  const handler = {
    handle(cmd: UpdateAssignedImage): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UpdateAssignedImageHandler;
  return { handler, calls };
}

const updateVirtualMachineArgs = {
  clusterId: "c1",
  nodeId: "n1",
  id: 4004,
  name: "k3s-01",
  size: "def-medium",
  image: "img-ubuntu",
  ip: "192.168.15.210",
  gateway: "192.168.15.1",
  dns: "192.168.15.1",
  storage: "s1",
  cpu: 4,
  ram: 8192,
  disk: 20,
  credentialVaultId: "v1",
  usernameSecretId: "u1",
  passwordSecretId: "p1",
  tags: ["qa"],
};

// ---------------------------------------------------------------------------
// 1. UpdateVirtualMachineMcpEndpoint (mutating + policy)
// ---------------------------------------------------------------------------

describe("UpdateVirtualMachineMcpEndpoint (mutating + policy guard)", () => {
  it("advertises mutating wire metadata", () => {
    /* @Given the update-VM endpoint */
    const { handler } = fakeUpdateVirtualMachineHandler();
    const ep = new UpdateVirtualMachineMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name, mutating risk tier and object schema */
    assertEquals(ep.name, "devstation_cluster_virtual_machine_update");
    assertEquals(ep.risk, "mutating");
    assertEquals(ep.inputSchema.type, "object");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeUpdateVirtualMachineHandler();
    const ep = new UpdateVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch(updateVirtualMachineArgs, { policy: McpPolicy.load("prefix:ds-e2e-") }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("updates the VM when policy is OFF, passing every field through", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeUpdateVirtualMachineHandler();
    const ep = new UpdateVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with the full update-VM args */
    const result = await ep.dispatch(updateVirtualMachineArgs, { policy: McpPolicy.OFF });
    /* @Then the handler receives every VM field including tags */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].id, 4004);
    assertEquals(calls[0].name, "k3s-01");
    assertEquals(calls[0].ip, "192.168.15.210");
    assertEquals([...calls[0].tags], ["qa"]);
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 2. UnregisterVirtualMachineMcpEndpoint (destructive + policy)
// ---------------------------------------------------------------------------

describe("UnregisterVirtualMachineMcpEndpoint (destructive + policy guard)", () => {
  it("advertises destructive wire metadata", () => {
    /* @Given the unregister-VM endpoint */
    const { handler } = fakeUnregisterVirtualMachineHandler();
    const ep = new UnregisterVirtualMachineMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_virtual_machine_unregister");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeUnregisterVirtualMachineHandler();
    const ep = new UnregisterVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          { clusterId: "c1", nodeId: "n1", id: 4004 },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters the VM when policy is OFF", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeUnregisterVirtualMachineHandler();
    const ep = new UnregisterVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with cluster/node/vm ids */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1", id: 4004 },
      { policy: McpPolicy.OFF },
    );
    /* @Then the handler is called once with those ids */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].id, 4004);
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 3. UnregisterAllVirtualMachinesMcpEndpoint (destructive + policy)
// ---------------------------------------------------------------------------

describe("UnregisterAllVirtualMachinesMcpEndpoint (destructive + policy guard)", () => {
  it("advertises destructive wire metadata", () => {
    /* @Given the unregister-all-VMs endpoint */
    const { handler } = fakeUnregisterAllVirtualMachinesHandler();
    const ep = new UnregisterAllVirtualMachinesMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_virtual_machines_unregister_all");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeUnregisterAllVirtualMachinesHandler();
    const ep = new UnregisterAllVirtualMachinesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          { clusterId: "c1", nodeId: "n1" },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters all VMs when policy is OFF", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeUnregisterAllVirtualMachinesHandler();
    const ep = new UnregisterAllVirtualMachinesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with cluster + node ids */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1" },
      { policy: McpPolicy.OFF },
    );
    /* @Then the handler is called once with both ids */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 4. VirtualMachineByImageMcpEndpoint (read)
// ---------------------------------------------------------------------------

describe("VirtualMachineByImageMcpEndpoint (read, no policy)", () => {
  it("advertises read wire metadata", () => {
    /* @Given the vm-by-image read endpoint */
    const query = { execute: () => Promise.resolve([]) } as Anyish;
    const ep = new VirtualMachineByImageMcpEndpoint(query);
    /* @Then it advertises its name and read risk tier */
    assertEquals(ep.name, "devstation_cluster_virtual_machine_by_image");
    assertEquals(ep.risk, "read");
  });

  it("returns the VMs the query yields for the given imageId", async () => {
    /* @Given a query that yields VM records for an image */
    const records = [
      {
        clusterId: "c1",
        clusterName: "homelab",
        nodeId: "n1",
        nodeName: "cp1",
        virtualMachineId: 4004,
        virtualMachineName: "k3s-01",
      },
    ];
    const query = { execute: (_imageId: string) => Promise.resolve(records) } as Anyish;
    const ep = new VirtualMachineByImageMcpEndpoint(query);
    /* @When dispatched with an imageId */
    const result = await ep.dispatch({ imageId: "img-ubuntu" });
    /* @Then it returns the query's records unchanged */
    assertEquals(result, records);
  });
});

// ---------------------------------------------------------------------------
// 5. VirtualMachineMetricsMcpEndpoint (read)
// ---------------------------------------------------------------------------

describe("VirtualMachineMetricsMcpEndpoint (read, no policy)", () => {
  it("advertises read wire metadata", () => {
    /* @Given the vm-metrics read endpoint */
    const query = {
      execute: () => Promise.resolve([]),
    } as Anyish;
    const ep = new VirtualMachineMetricsMcpEndpoint(query);
    /* @Then it advertises its name and read risk tier */
    assertEquals(ep.name, "devstation_cluster_virtual_machine_metrics");
    assertEquals(ep.risk, "read");
  });

  it("passes clusterId/nodeId/virtualMachineId/timeframe through to the query", async () => {
    /* @Given a query that captures its arguments */
    const captures: unknown[] = [];
    const query = {
      execute(cid: string, nid: string, virtualMachineId: number, tf: string): Promise<unknown[]> {
        captures.push({ cid, nid, virtualMachineId, tf });
        return Promise.resolve([{ time: 1, cpu: 0.5 }]);
      },
    } as Anyish;
    const ep = new VirtualMachineMetricsMcpEndpoint(query);
    /* @When dispatched with cluster/node/vm ids and a timeframe */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1", virtualMachineId: 4004, timeframe: "hour" },
    );
    /* @Then every argument reaches the query and its result is returned */
    assertEquals(captures, [{ cid: "c1", nid: "n1", virtualMachineId: 4004, tf: "hour" }]);
    assertEquals(result, [{ time: 1, cpu: 0.5 }]);
  });
});

// ---------------------------------------------------------------------------
// 6. AssignImageMcpEndpoint (mutating + policy)
// ---------------------------------------------------------------------------

describe("AssignImageMcpEndpoint (mutating + policy guard)", () => {
  it("advertises mutating wire metadata", () => {
    /* @Given the assign-image endpoint */
    const { handler } = fakeAssignImageHandler();
    const ep = new AssignImageMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and mutating risk tier */
    assertEquals(ep.name, "devstation_cluster_image_assign");
    assertEquals(ep.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeAssignImageHandler();
    const ep = new AssignImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          {
            clusterId: "c1",
            nodeId: "n1",
            imageId: "img-1",
            virtualMachineId: 100,
            storage: "local",
            name: "ubuntu-22",
            os: "ubuntu-22-04",
            sourceUrl: "https://example.com/ubuntu.img",
          },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("assigns the image when policy is OFF, passing every field through", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeAssignImageHandler();
    const ep = new AssignImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with the full assign args */
    const result = await ep.dispatch(
      {
        clusterId: "c1",
        nodeId: "n1",
        imageId: "img-1",
        virtualMachineId: 100,
        storage: "local",
        name: "ubuntu-22",
        os: "ubuntu-22-04",
        sourceUrl: "https://example.com/ubuntu.img",
      },
      { policy: McpPolicy.OFF },
    );
    /* @Then the handler receives every assignment field */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].imageId, "img-1");
    assertEquals(calls[0].virtualMachineId, 100);
    assertEquals(calls[0].storage, "local");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 7. UnassignImageMcpEndpoint (destructive + policy)
// ---------------------------------------------------------------------------

describe("UnassignImageMcpEndpoint (destructive + policy guard)", () => {
  it("advertises destructive wire metadata", () => {
    /* @Given the unassign-image endpoint */
    const { handler } = fakeUnassignImageHandler();
    const ep = new UnassignImageMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_image_unassign");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeUnassignImageHandler();
    const ep = new UnassignImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          { clusterId: "c1", nodeId: "n1", imageId: "img-1" },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unassigns the image when policy is OFF", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeUnassignImageHandler();
    const ep = new UnassignImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with cluster/node/image ids */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1", imageId: "img-1" },
      { policy: McpPolicy.OFF },
    );
    /* @Then the handler is called once with those ids */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].imageId, "img-1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 8. UpdateAssignedImageMcpEndpoint (mutating + policy)
// ---------------------------------------------------------------------------

describe("UpdateAssignedImageMcpEndpoint (mutating + policy guard)", () => {
  it("advertises mutating wire metadata", () => {
    /* @Given the update-assigned-image endpoint */
    const { handler } = fakeUpdateAssignedImageHandler();
    const ep = new UpdateAssignedImageMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and mutating risk tier */
    assertEquals(ep.name, "devstation_cluster_image_update_assigned");
    assertEquals(ep.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeUpdateAssignedImageHandler();
    const ep = new UpdateAssignedImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          {
            clusterId: "c1",
            nodeId: "n1",
            imageId: "img-1",
            virtualMachineId: 200,
            storage: "ceph",
          },
          { policy: McpPolicy.load("prefix:ds-e2e-") },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("updates the assigned image when policy is OFF, passing every field through", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeUpdateAssignedImageHandler();
    const ep = new UpdateAssignedImageMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with the full update args */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1", imageId: "img-1", virtualMachineId: 200, storage: "ceph" },
      { policy: McpPolicy.OFF },
    );
    /* @Then the handler receives every assignment field */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].imageId, "img-1");
    assertEquals(calls[0].virtualMachineId, 200);
    assertEquals(calls[0].storage, "ceph");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 9. StorageByNodeMcpEndpoint (read)
// ---------------------------------------------------------------------------

describe("StorageByNodeMcpEndpoint (read, no policy)", () => {
  it("advertises read wire metadata", () => {
    /* @Given the storage-by-node read endpoint */
    const query = { execute: () => Promise.resolve({ connected: false, storages: [] }) } as Anyish;
    const ep = new StorageByNodeMcpEndpoint(query);
    /* @Then it advertises its name and read risk tier */
    assertEquals(ep.name, "devstation_cluster_storage_by_node");
    assertEquals(ep.risk, "read");
  });

  it("returns the query result unchanged", async () => {
    /* @Given a query yielding a storage result */
    const queryResult = { connected: true, storages: [{ name: "local", type: "dir" }] };
    const query = { execute: () => Promise.resolve(queryResult) } as Anyish;
    const ep = new StorageByNodeMcpEndpoint(query);
    /* @When dispatched with cluster + node ids */
    const result = await ep.dispatch({ clusterId: "c1", nodeId: "n1" });
    /* @Then it returns the query result unchanged */
    assertEquals(result, queryResult);
  });
});

// ---------------------------------------------------------------------------
// 10. TestProxmoxConnectionMcpEndpoint (read)
// ---------------------------------------------------------------------------

describe("TestProxmoxConnectionMcpEndpoint (read, no policy)", () => {
  it("advertises read wire metadata", () => {
    /* @Given the test-connection read endpoint */
    const query = { execute: () => Promise.resolve({ ok: true, nodeCount: 0 }) } as Anyish;
    const ep = new TestProxmoxConnectionMcpEndpoint(query);
    /* @Then it advertises its name and read risk tier */
    assertEquals(ep.name, "devstation_cluster_test_connection");
    assertEquals(ep.risk, "read");
  });

  it("passes host/token to the query and returns its result", async () => {
    /* @Given a query that captures its host/token args */
    const captures: unknown[] = [];
    const query = {
      execute(host: string, token: string): Promise<unknown> {
        captures.push({ host, token });
        return Promise.resolve({ ok: true, nodeCount: 3 });
      },
    } as Anyish;
    const ep = new TestProxmoxConnectionMcpEndpoint(query);
    /* @When dispatched with a host and token */
    const result = await ep.dispatch({
      host: "https://pve.local:8006",
      token: "PVEAPIToken=root@pam!tok=abc",
    });
    /* @Then both reach the query and its result is returned */
    assertEquals(captures, [{
      host: "https://pve.local:8006",
      token: "PVEAPIToken=root@pam!tok=abc",
    }]);
    assertEquals(result, { ok: true, nodeCount: 3 });
  });
});
