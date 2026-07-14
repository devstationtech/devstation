import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxStorageByNodeResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as StoragesByNodeQuery } from "@server/cluster/application/queries/proxmox/storage/by-node/query.ts";
import { StorageByNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/storage/by-node/endpoint.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import type { ProxmoxStorageRecord } from "@server/cluster/application/queries/proxmox/records/storage-record.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { STUB_SESSION_ID, StubAuthentication } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function fakeApi(storages: ProxmoxStorageRecord[] | (() => never)): ProxmoxReadApi {
  return {
    storages: () => {
      if (typeof storages === "function") return storages();
      return Promise.resolve(storages);
    },
  } as unknown as ProxmoxReadApi;
}

function buildRpc(query: StoragesByNodeQuery): Client {
  const endpoint = new StorageByNodeEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.storage.byNode endpoint — integration", () => {
  it("returns disconnected + empty when cluster has no connection", async () => {
    /* @Given a persisted cluster + node with no connection */
    const persistence = new Persistence();
    try {
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
            images: [],
            virtualMachines: [],
          }],
        },
      ]);
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = { create: () => Promise.resolve(fakeApi([])) };
      const rpc = buildRpc(new StoragesByNodeQuery(fs, factory));

      /* @When storage is queried for the node */
      const response = await rpc.invoke<ClusterProxmoxStorageByNodeResponse>(
        "cluster.proxmox.storage.byNode",
        { sessionId: STUB_SESSION_ID, clusterId: "c1", nodeId: "n1" },
      );
      /* @Then it reports disconnected with no storages */
      assertEquals(response, { connected: false, storages: [] });
    } finally {
      await persistence.teardown();
    }
  });

  it("returns the api storages when connected", async () => {
    /* @Given a connected cluster + node and an api returning storage records */
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
      const sample: ProxmoxStorageRecord[] = [
        { id: "local-zfs", type: "zfspool", available: 100, total: 500 },
      ];
      const factory: ProxmoxReadApiFactory = { create: () => Promise.resolve(fakeApi(sample)) };
      const rpc = buildRpc(new StoragesByNodeQuery(fs, factory));

      /* @When storage is queried for the node */
      const response = await rpc.invoke<ClusterProxmoxStorageByNodeResponse>(
        "cluster.proxmox.storage.byNode",
        { sessionId: STUB_SESSION_ID, clusterId: "c1", nodeId: "n1" },
      );
      /* @Then it reports connected with the api storages */
      assertEquals(response, { connected: true, storages: sample });
    } finally {
      await persistence.teardown();
    }
  });
});
