import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as StorageByNodeQuery } from "@server/cluster/application/queries/proxmox/storage/by-node/query.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";

/**
 * `cluster.proxmox.storage.by-node` query — every "disconnected"
 * branch must degrade to `{ connected:false, storages:[] }` instead
 * of throwing: cluster missing, no connection, node missing, factory
 * yields null, API call throws. The single happy path returns the
 * live storages with `connected:true`.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

/** Factory that always yields the given API (or null to simulate no-connect). */
function factoryOf(api: ProxmoxReadApi | null): ProxmoxReadApiFactory {
  return { create: () => Promise.resolve(api) };
}

/** Read API whose `storages()` resolves to the given list (or throws). */
function apiWith(storages: unknown[] | Error): ProxmoxReadApi {
  return {
    storages: () =>
      storages instanceof Error ? Promise.reject(storages) : Promise.resolve(storages),
  } as Anyish as ProxmoxReadApi;
}

const CONNECTED_CLUSTER = [{
  id: "c1",
  connection: { host: "proxmox.example.com", vaultId: "v1", secretId: "s1" },
  nodes: [{ id: "n1", name: "cp4" }],
}];

async function withClusters<T>(
  raw: unknown,
  factory: ProxmoxReadApiFactory,
  fn: (q: StorageByNodeQuery) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "storage-by-node-" });
  try {
    await Deno.writeTextFile(join(dir, "clusters.json"), JSON.stringify(raw));
    return await fn(new StorageByNodeQuery(new FileSystem(dir), factory));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

describe("StorageByNodeQuery.execute", () => {
  it("disconnected when the cluster id is not found", async () => {
    const r = await withClusters([], factoryOf(apiWith([])), (q) => q.execute("nope", "n1"));
    assertEquals(r, { connected: false, storages: [] });
  });

  it("disconnected when the cluster has no connection", async () => {
    const r = await withClusters(
      [{ id: "c1", nodes: [{ id: "n1", name: "cp4" }] }],
      factoryOf(apiWith([])),
      (q) => q.execute("c1", "n1"),
    );
    assertEquals(r, { connected: false, storages: [] });
  });

  it("disconnected when the node id is not found on the cluster", async () => {
    const r = await withClusters(
      CONNECTED_CLUSTER,
      factoryOf(apiWith([])),
      (q) => q.execute("c1", "ghost-node"),
    );
    assertEquals(r, { connected: false, storages: [] });
  });

  it("disconnected when the API factory yields null (credentials unresolved)", async () => {
    const r = await withClusters(
      CONNECTED_CLUSTER,
      factoryOf(null),
      (q) => q.execute("c1", "n1"),
    );
    assertEquals(r, { connected: false, storages: [] });
  });

  it("disconnected (graceful) when the API call throws — provider unreachable", async () => {
    /* @Given a reachable factory whose `storages()` rejects */
    const r = await withClusters(
      CONNECTED_CLUSTER,
      factoryOf(apiWith(new Error("ECONNREFUSED"))),
      (q) => q.execute("c1", "n1"),
    );
    /* @Then the query swallows it — never propagates a provider error */
    assertEquals(r, { connected: false, storages: [] });
  });

  it("connected with the live storages on the happy path", async () => {
    /* @Given the provider returns two datastores for node cp4 */
    const storages = [
      { id: "local-lvm", type: "lvmthin", available: 500, total: 1000 },
      { id: "local-zfs", type: "zfspool", available: 800, total: 2000 },
    ];
    const r = await withClusters(
      CONNECTED_CLUSTER,
      factoryOf(apiWith(storages)),
      (q) => q.execute("c1", "n1"),
    );
    /* @Then connected:true with the storages relayed verbatim */
    assertEquals(r.connected, true);
    assertEquals(r.storages, storages);
  });
});
