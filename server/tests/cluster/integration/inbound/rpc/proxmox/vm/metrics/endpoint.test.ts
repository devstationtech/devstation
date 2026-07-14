import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxVirtualMachineMetricsResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as VirtualMachineMetricsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/query.ts";
import { VirtualMachineMetricsEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/metrics/endpoint.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { STUB_SESSION_ID, StubAuthentication } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function fakeApi(): ProxmoxReadApi {
  return {
    vmMetrics: () =>
      Promise.resolve([
        {
          time: 1700000000,
          cpuPercent: 12.5,
          ramUsedGiB: 1.2,
          ramTotalGiB: 4.0,
          diskReadMBs: 0.1,
          diskWriteMBs: 0.05,
          netInMBs: 0.2,
          netOutMBs: 0.15,
        },
      ]),
  } as unknown as ProxmoxReadApi;
}

function buildRpc(query: VirtualMachineMetricsQuery): Client {
  const endpoint = new VirtualMachineMetricsEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.virtualMachine.metrics endpoint — integration", () => {
  it("returns an empty array when the cluster has no connection or is missing", async () => {
    /* @Given a fresh persistence dir (no clusters at all) */
    const persistence = new Persistence();
    try {
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = { create: () => Promise.resolve(fakeApi()) };
      const query = new VirtualMachineMetricsQuery(fs, factory);
      const rpc = buildRpc(query);

      const response = await rpc.invoke<ClusterProxmoxVirtualMachineMetricsResponse>(
        "cluster.proxmox.virtualMachine.metrics",
        {
          sessionId: STUB_SESSION_ID,
          clusterId: "non-existent",
          nodeId: "x",
          virtualMachineId: 100,
          timeframe: "hour",
        },
      );
      assertEquals(response, []);
    } finally {
      await persistence.teardown();
    }
  });

  it("returns the api result when the cluster + connection + node are present", async () => {
    /* @Given a persisted connected cluster with a node */
    const persistence = new Persistence();
    try {
      await persistence.writeClusters([
        {
          provider: "proxmox",
          id: "c1",
          name: "homelab",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          connection: { host: "10.0.0.5", vaultId: "v", secretId: "s" },
          images: [],
          nodes: [{
            id: "n1",
            name: "node-1",
            address: "10.0.0.10",
            credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
            images: [],
            virtualMachines: [],
          }],
        },
      ]);
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = { create: () => Promise.resolve(fakeApi()) };
      const query = new VirtualMachineMetricsQuery(fs, factory);
      const rpc = buildRpc(query);

      const response = await rpc.invoke<ClusterProxmoxVirtualMachineMetricsResponse>(
        "cluster.proxmox.virtualMachine.metrics",
        {
          sessionId: STUB_SESSION_ID,
          clusterId: "c1",
          nodeId: "n1",
          virtualMachineId: 100,
          timeframe: "hour",
        },
      );
      assertEquals(response.length, 1);
      assertEquals(response[0].cpuPercent, 12.5);
      assertEquals(response[0].ramUsedGiB, 1.2);
    } finally {
      await persistence.teardown();
    }
  });
});
