import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/query.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxConnectionRecord } from "@server/cluster/application/queries/proxmox/records/connection-record.ts";
import type { ProxmoxVirtualMachineMetricPointRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-metric-point.ts";
import type { ProxmoxLiveResources } from "@server/cluster/application/queries/proxmox/records/live-resources.ts";
import type { ProxmoxStorageRecord } from "@server/cluster/application/queries/proxmox/records/storage-record.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";

type FactoryCall = { connection: ProxmoxConnectionRecord };
type ApiCall = { node: string; virtualMachineId: number; timeframe: ProxmoxMetricsTimeframe };

function fakeApi(points: ProxmoxVirtualMachineMetricPointRecord[], log: ApiCall[]): ProxmoxReadApi {
  return {
    liveNodes: () => Promise.resolve(new Map<string, ProxmoxLiveResources>()),
    liveVirtualMachines: () => Promise.resolve(new Map<number, ProxmoxLiveResources>()),
    storages: () => Promise.resolve([] as ProxmoxStorageRecord[]),
    vmMetrics: (node, virtualMachineId, timeframe) => {
      log.push({ node, virtualMachineId, timeframe });
      return Promise.resolve(points);
    },
  };
}

function fakeFactory(api: ProxmoxReadApi | null, calls: FactoryCall[]): ProxmoxReadApiFactory {
  return {
    create: (connection) => {
      calls.push({ connection });
      return Promise.resolve(api);
    },
  };
}

const POINT: ProxmoxVirtualMachineMetricPointRecord = {
  time: 1_700_000_000,
  cpuPercent: 23,
  ramUsedGiB: 1.5,
  ramTotalGiB: 4,
  diskReadMBs: 0.1,
  diskWriteMBs: 0.2,
  netInMBs: 0.3,
  netOutMBs: 0.4,
};

describe("virtual-machine metrics query", () => {
  let dir: string;

  beforeEach(() => {
    dir = Deno.makeTempDirSync();
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  const writeJson = (file: string, content: unknown) =>
    writeFile(join(dir, file), JSON.stringify(content, null, 2), "utf-8");

  it("should return empty when cluster does not exist", async () => {
    /* @Given no persisted cluster */
    const calls: FactoryCall[] = [];
    const apiCalls: ApiCall[] = [];
    const query = new Query(
      new FileSystem(dir),
      fakeFactory(fakeApi([POINT], apiCalls), calls),
    );

    /* @When the query is executed with a nonexistent clusterId */
    const result = await query.execute("missing", "n1", 100, "hour");

    /* @Then it should return [] and not call the factory */
    assertEquals(result, []);
    assertEquals(calls.length, 0);
    assertEquals(apiCalls.length, 0);
  });

  it("should return empty when cluster has no connection", async () => {
    /* @Given a cluster without a connection */
    await writeJson("clusters.json", [{
      id: "c1",
      provider: "proxmox",
      connection: null,
      nodes: [{ id: "n1", name: "cp1", virtualMachines: [] }],
    }]);
    const calls: FactoryCall[] = [];
    const apiCalls: ApiCall[] = [];
    const query = new Query(
      new FileSystem(dir),
      fakeFactory(fakeApi([POINT], apiCalls), calls),
    );

    /* @When the query is executed */
    const result = await query.execute("c1", "n1", 100, "hour");

    /* @Then it should return [] and not call the factory */
    assertEquals(result, []);
    assertEquals(calls.length, 0);
    assertEquals(apiCalls.length, 0);
  });

  it("should return empty when node does not exist in cluster", async () => {
    /* @Given a cluster with a connection but without the requested node */
    await writeJson("clusters.json", [{
      id: "c1",
      provider: "proxmox",
      connection: { host: "10.0.0.1", vaultId: "v1", secretId: "s1" },
      nodes: [{ id: "n1", name: "cp1", virtualMachines: [] }],
    }]);
    const calls: FactoryCall[] = [];
    const apiCalls: ApiCall[] = [];
    const query = new Query(
      new FileSystem(dir),
      fakeFactory(fakeApi([POINT], apiCalls), calls),
    );

    /* @When the query is executed with a nonexistent nodeId */
    const result = await query.execute("c1", "missing-node", 100, "hour");

    /* @Then it should return [] and not call the factory */
    assertEquals(result, []);
    assertEquals(calls.length, 0);
    assertEquals(apiCalls.length, 0);
  });

  it("should return empty when factory cannot create api", async () => {
    /* @Given a valid cluster but a factory that returns null */
    await writeJson("clusters.json", [{
      id: "c1",
      provider: "proxmox",
      connection: { host: "10.0.0.1", vaultId: "v1", secretId: "s1" },
      nodes: [{ id: "n1", name: "cp1", virtualMachines: [] }],
    }]);
    const calls: FactoryCall[] = [];
    const apiCalls: ApiCall[] = [];
    const query = new Query(new FileSystem(dir), fakeFactory(null, calls));

    /* @When the query is executed */
    const result = await query.execute("c1", "n1", 100, "hour");

    /* @Then it should return [] and the factory should have been called */
    assertEquals(result, []);
    assertEquals(calls.length, 1);
    assertEquals(apiCalls.length, 0);
  });

  it("should call factory and api with the right arguments", async () => {
    /* @Given a valid cluster with the requested node */
    await writeJson("clusters.json", [{
      id: "c1",
      provider: "proxmox",
      connection: { host: "10.0.0.1", vaultId: "v1", secretId: "s1" },
      nodes: [{ id: "n1", name: "cp1", virtualMachines: [] }],
    }]);
    const calls: FactoryCall[] = [];
    const apiCalls: ApiCall[] = [];
    const query = new Query(
      new FileSystem(dir),
      fakeFactory(fakeApi([POINT], apiCalls), calls),
    );

    /* @When the query is executed */
    const result = await query.execute("c1", "n1", 100, "day");

    /* @Then it should return the points and the api should have been called with node.name, virtualMachineId, timeframe */
    assertEquals(result, [POINT]);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].connection, { host: "10.0.0.1", vaultId: "v1", secretId: "s1" });
    assertEquals(apiCalls.length, 1);
    assertEquals(apiCalls[0], { node: "cp1", virtualMachineId: 100, timeframe: "day" });
  });
});
