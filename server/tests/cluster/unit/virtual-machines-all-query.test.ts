import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import {
  ClusterOrNodeNotFoundError,
  Query as AllVirtualMachinesQuery,
} from "@server/cluster/application/queries/proxmox/virtual-machine/all/query.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";

/**
 * `cluster.proxmox.virtualMachine.list` query — projects a node's VMs and (when
 * the cluster is connected) enriches each with live Proxmox resources.
 * Never throws: an unreachable provider degrades to the static
 * records. Pins the projection (size/image name resolution),
 * every offline branch, and the live-merge happy path.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

const VM = {
  id: 101,
  name: "k3s-server",
  tags: ["k3s"],
  sizeId: "def-1",
  image: "img-1",
  address: "10.0.0.5",
  gateway: "10.0.0.1",
  dns: "10.0.0.1",
  storage: "local-lvm",
  credentialVaultId: "v1",
  usernameSecretId: "u1",
  passwordSecretId: "p1",
  resources: { cpu: 2, memory: 2048 },
  services: [],
};

/** A cluster with one node + one VM; `connection` toggled per test. */
function clusterRaw(connection: unknown): unknown {
  return [{
    id: "c1",
    connection,
    nodes: [{
      id: "n1",
      name: "cp4",
      images: [{ imageId: "img-1", name: "ubuntu-22", os: "ubuntu-22-04" }],
      virtualMachines: [VM],
    }],
  }];
}

const SIZES = [{ id: "def-1", name: "small" }];

function factoryOf(api: ProxmoxReadApi | null): ProxmoxReadApiFactory {
  return { create: () => Promise.resolve(api) };
}

function apiWithLiveVirtualMachines(map: Map<number, unknown> | Error): ProxmoxReadApi {
  return {
    liveVirtualMachines: () => (map instanceof Error ? Promise.reject(map) : Promise.resolve(map)),
  } as Anyish as ProxmoxReadApi;
}

async function withFs<T>(
  clusters: unknown,
  factory: ProxmoxReadApiFactory,
  fn: (q: AllVirtualMachinesQuery) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "vm-all-query-" });
  try {
    await Deno.writeTextFile(join(dir, "clusters.json"), JSON.stringify(clusters));
    await Deno.writeTextFile(join(dir, "sizes.json"), JSON.stringify(SIZES));
    return await fn(new AllVirtualMachinesQuery(new FileSystem(dir), factory));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

describe("AllVirtualMachinesQuery.execute", () => {
  it("returns [] when the cluster id is not found", async () => {
    const virtualMachines = await withFs(
      clusterRaw(null),
      factoryOf(null),
      (q) => q.execute("missing", "n1"),
    );
    assertEquals(virtualMachines, []);
  });

  it("returns [] when the node id is not found on the cluster", async () => {
    const virtualMachines = await withFs(
      clusterRaw(null),
      factoryOf(null),
      (q) => q.execute("c1", "ghost"),
    );
    assertEquals(virtualMachines, []);
  });

  it("projects static records (resolving size + image names) when the cluster has no connection", async () => {
    /* @Given a cluster with no Proxmox connection */
    const virtualMachines = await withFs(
      clusterRaw(undefined),
      factoryOf(null),
      (q) => q.execute("c1", "n1"),
    );
    /* @Then one record, enriched names resolved, resources offline */
    assertEquals(virtualMachines.length, 1);
    assertEquals(virtualMachines[0].name, "k3s-server");
    assertEquals(virtualMachines[0].sizeName, "small");
    assertEquals(virtualMachines[0].imageName, "ubuntu-22");
    assertEquals(virtualMachines[0].imageOs, "ubuntu-22-04");
    assertEquals(virtualMachines[0].resources.connected, false);
  });

  it("returns static records when the API factory yields null (credentials unresolved)", async () => {
    /* @Given a connected cluster but the factory can't build an API */
    const virtualMachines = await withFs(
      clusterRaw({ host: "pve", vaultId: "v", secretId: "s" }),
      factoryOf(null),
      (q) => q.execute("c1", "n1"),
    );
    assertEquals(virtualMachines[0].resources.connected, false);
  });

  it("degrades to static records when liveVirtualMachines throws (provider unreachable)", async () => {
    /* @Given a reachable factory whose `liveVirtualMachines` rejects */
    const virtualMachines = await withFs(
      clusterRaw({ host: "pve", vaultId: "v", secretId: "s" }),
      factoryOf(apiWithLiveVirtualMachines(new Error("ETIMEDOUT"))),
      (q) => q.execute("c1", "n1"),
    );
    /* @Then the query never propagates the error — record stays offline */
    assertEquals(virtualMachines.length, 1);
    assertEquals(virtualMachines[0].resources.connected, false);
  });

  // ---- executeOrThrow — MCP-only strict variant ----
  // RPC keeps `execute` (lenient, returns []); MCP uses `executeOrThrow`
  // so callers can distinguish "no VMs" from "wrong id" instead of
  // silently receiving an empty list and concluding the node is empty.

  it("executeOrThrow rejects with ClusterOrNodeNotFoundError when cluster is missing", async () => {
    await withFs(clusterRaw(null), factoryOf(null), async (q) => {
      const err = await assertRejects(
        () => q.executeOrThrow("missing", "n1"),
        ClusterOrNodeNotFoundError,
      );
      // Remediation hint must point at the discovery tool — that's the
      // whole point of throwing instead of returning [].
      assertEquals(err.message.includes("devstation_cluster_list"), true);
    });
  });

  it("executeOrThrow rejects with ClusterOrNodeNotFoundError when node is missing", async () => {
    await withFs(clusterRaw(null), factoryOf(null), async (q) => {
      const err = await assertRejects(
        () => q.executeOrThrow("c1", "ghost"),
        ClusterOrNodeNotFoundError,
      );
      assertEquals(err.message.includes("devstation_cluster_nodes_list"), true);
    });
  });

  it("executeOrThrow returns the same projection as execute on the happy path", async () => {
    await withFs(clusterRaw(undefined), factoryOf(null), async (q) => {
      const strict = await q.executeOrThrow("c1", "n1");
      const lenient = await q.execute("c1", "n1");
      assertEquals(strict, lenient);
    });
  });

  it("merges live resources into the matching VM on the connected happy path", async () => {
    /* @Given the provider reports live resources for vmid 101 */
    const live = { status: "running", cpu: 0.4, memory: 1024 };
    const virtualMachines = await withFs(
      clusterRaw({ host: "pve", vaultId: "v", secretId: "s" }),
      factoryOf(apiWithLiveVirtualMachines(new Map<number, unknown>([[101, live]]))),
      (q) => q.execute("c1", "n1"),
    );
    /* @Then the record is marked connected and carries the live snapshot */
    assertEquals(virtualMachines[0].resources.connected, true);
    assertEquals((virtualMachines[0].resources as { live?: unknown }).live, live);
  });
});
