import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxVirtualMachineListResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as AllVirtualMachinesQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/all/query.ts";
import { ListProxmoxVirtualMachinesEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/list/endpoint.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import type { ProxmoxLiveResources } from "@server/cluster/application/queries/proxmox/records/live-resources.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { STUB_SESSION_ID, StubAuthentication } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function fakeApi(liveByVirtualMachineId: Map<number, ProxmoxLiveResources>): ProxmoxReadApi {
  return {
    liveVirtualMachines: () => Promise.resolve(liveByVirtualMachineId),
  } as unknown as ProxmoxReadApi;
}

function buildRpc(query: AllVirtualMachinesQuery): Client {
  const endpoint = new ListProxmoxVirtualMachinesEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.virtualMachine.list endpoint — integration", () => {
  it("returns an empty array for an unknown cluster/node", async () => {
    /* @Given no clusters persisted */
    const persistence = new Persistence();
    try {
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllVirtualMachinesQuery(fs, factory));

      /* @When VMs are listed for an unknown cluster/node */
      const response = await rpc.invoke<ClusterProxmoxVirtualMachineListResponse>(
        "cluster.proxmox.virtualMachine.list",
        { sessionId: STUB_SESSION_ID, clusterId: "missing", nodeId: "x" },
      );
      /* @Then an empty list is returned */
      assertEquals(response, []);
    } finally {
      await persistence.teardown();
    }
  });

  it("returns enriched VM rows (static-only when cluster disconnected)", async () => {
    /* @Given a disconnected cluster with a node hosting a VM plus its size */
    const persistence = new Persistence();
    try {
      // Write all 4 files the query reads
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
            credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
            images: [{
              imageId: "img-1",
              name: "ubuntu-2204",
              os: "ubuntu",
              virtualMachineId: 9000,
              storage: "local",
            }],
            virtualMachines: [{
              id: 100,
              name: "test-vm",
              tags: ["web", "prod"],
              sizeId: "def-1",
              image: "img-1",
              address: "10.0.0.100",
              gateway: "10.0.0.1",
              dns: "10.0.0.1",
              storage: "local",
              credentialVaultId: "v",
              usernameSecretId: "u",
              passwordSecretId: "p",
              resources: { cpu: 2, ram: 1024, disk: 20 },
              services: [],
            }],
          }],
        },
      ]);
      await Deno.writeTextFile(
        `${persistence.dir}/sizes.json`,
        JSON.stringify([{ id: "def-1", name: "small" }]),
      );

      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllVirtualMachinesQuery(fs, factory));

      /* @When VMs are listed for the node */
      const response = await rpc.invoke<ClusterProxmoxVirtualMachineListResponse>(
        "cluster.proxmox.virtualMachine.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1", nodeId: "n1" },
      );
      /* @Then the row is enriched with size/image names and reported disconnected */
      assertEquals(response.length, 1);
      assertEquals(response[0].id, 100);
      assertEquals(response[0].tags, ["web", "prod"]);
      assertEquals(response[0].sizeName, "small");
      assertEquals(response[0].imageName, "ubuntu-2204");
      assertEquals(response[0].resources.connected, false);
    } finally {
      await persistence.teardown();
    }
  });
});
