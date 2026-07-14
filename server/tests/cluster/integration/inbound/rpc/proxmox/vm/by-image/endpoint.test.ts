import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxVirtualMachineByImageResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as VirtualMachineByImageQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/query.ts";
import { VirtualMachineByImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/by-image/endpoint.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { STUB_SESSION_ID, StubAuthentication } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function buildRpc(query: VirtualMachineByImageQuery): Client {
  const endpoint = new VirtualMachineByImageEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.virtualMachine.byImage endpoint — integration", () => {
  it("returns an empty array when no clusters exist", async () => {
    /* @Given no clusters persisted */
    const persistence = new Persistence();
    try {
      const fs = new FileSystem(persistence.dir);
      const rpc = buildRpc(new VirtualMachineByImageQuery(fs));
      /* @When VMs are queried by image id */
      const response = await rpc.invoke<ClusterProxmoxVirtualMachineByImageResponse>(
        "cluster.proxmox.virtualMachine.byImage",
        { sessionId: STUB_SESSION_ID, imageId: "img-1" },
      );
      /* @Then an empty list is returned */
      assertEquals(response, []);
    } finally {
      await persistence.teardown();
    }
  });

  it("returns matches across clusters and nodes for the given image id", async () => {
    /* @Given two clusters whose nodes host VMs on several images */
    const persistence = new Persistence();
    try {
      const baseVirtualMachine = {
        roleId: "r1",
        sizeId: "d1",
        environmentId: "e1",
        address: "10.0.0.50",
        resources: { cpu: 1, ram: 512, disk: 10 },
      };
      await persistence.writeClusters([
        {
          provider: "proxmox",
          id: "c1",
          name: "homelab",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          nodes: [{
            id: "n1",
            name: "node-1",
            address: "10.0.0.10",
            virtualMachines: [
              { ...baseVirtualMachine, id: 100, name: "vm-100", image: "img-target" },
              { ...baseVirtualMachine, id: 101, name: "vm-101", image: "other-img" },
            ],
          }],
        },
        {
          provider: "proxmox",
          id: "c2",
          name: "prod",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-02T00:00:00.000Z" },
          nodes: [{
            id: "n2",
            name: "node-2",
            address: "10.0.0.11",
            virtualMachines: [
              { ...baseVirtualMachine, id: 200, name: "vm-200", image: "img-target" },
            ],
          }],
        },
      ]);

      const fs = new FileSystem(persistence.dir);
      const rpc = buildRpc(new VirtualMachineByImageQuery(fs));
      /* @When VMs are queried for the target image */
      const response = await rpc.invoke<ClusterProxmoxVirtualMachineByImageResponse>(
        "cluster.proxmox.virtualMachine.byImage",
        { sessionId: STUB_SESSION_ID, imageId: "img-target" },
      );

      /* @Then only the matching VMs across clusters/nodes come back */
      assertEquals(response.length, 2);
      const vmIds = response.map((r) => r.virtualMachineId).sort();
      assertEquals(vmIds, [100, 200]);
    } finally {
      await persistence.teardown();
    }
  });
});
