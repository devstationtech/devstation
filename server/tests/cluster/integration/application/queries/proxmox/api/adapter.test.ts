import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProxmoxApiAdapter } from "@server/cluster/application/queries/proxmox/api/adapter.ts";
import type { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";
import type { ClusterResource } from "@server/cluster/application/queries/proxmox/api/response/cluster-resource.ts";
import type { NodeStorage } from "@server/cluster/application/queries/proxmox/api/response/node-storage.ts";
import type { VirtualMachineMetricPoint } from "@server/cluster/application/queries/proxmox/api/response/virtual-machine-metric-point.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";

const CONFIG = { host: "10.0.0.1", token: "tok" };

type FakeIntegrationOptions = {
  resources?: ClusterResource[] | (() => never);
  storages?: NodeStorage[] | (() => never);
  metrics?: VirtualMachineMetricPoint[] | (() => never);
  metricsCalls?: { node: string; virtualMachineId: number; timeframe: ProxmoxMetricsTimeframe }[];
  storageCalls?: { node: string }[];
};

function fakeIntegration(opts: FakeIntegrationOptions): ProxmoxIntegration {
  return {
    clusterResources: () => {
      if (typeof opts.resources === "function") return opts.resources();
      return Promise.resolve(opts.resources ?? []);
    },
    nodeStorages: (node: string) => {
      opts.storageCalls?.push({ node });
      if (typeof opts.storages === "function") return opts.storages();
      return Promise.resolve(opts.storages ?? []);
    },
    vmMetrics: (node: string, virtualMachineId: number, timeframe: ProxmoxMetricsTimeframe) => {
      opts.metricsCalls?.push({ node, virtualMachineId, timeframe });
      if (typeof opts.metrics === "function") return opts.metrics();
      return Promise.resolve(opts.metrics ?? []);
    },
  } as unknown as ProxmoxIntegration;
}

describe("ProxmoxApiAdapter", () => {
  describe("liveNodes", () => {
    it("should map node resources to ProxmoxLiveResources keyed by node name", async () => {
      /* @Given a /cluster/resources response with nodes and qemus */
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({
          resources: [
            {
              type: "node",
              node: "cp1",
              status: "online",
              cpu: 0.5,
              maxcpu: 8,
              mem: 4 * 1024 * 1024 * 1024,
              maxmem: 16 * 1024 * 1024 * 1024,
              disk: 32 * 1024 * 1024 * 1024,
              maxdisk: 128 * 1024 * 1024 * 1024,
              uptime: 3600,
            },
            { type: "qemu", node: "cp1", vmid: 100 }, // ignored (not a node resource)
            { type: "node", node: "cp2", status: "offline" },
          ],
        }),
      );

      /* @When liveNodes is called */
      const result = await adapter.liveNodes();

      /* @Then it should return a Map indexed by name with the correct mapping */
      assertEquals(result.size, 2);
      const cp1 = result.get("cp1")!;
      assertEquals(cp1.status, "online");
      assertEquals(cp1.cpuCores, 8);
      assertEquals(cp1.cpuPercent, 50);
      assertEquals(cp1.ramUsedGiB, 4);
      assertEquals(cp1.ramTotalGiB, 16);
      assertEquals(cp1.diskUsedGiB, 32);
      assertEquals(cp1.diskTotalGiB, 128);
      assertEquals(cp1.uptimeSeconds, 3600);
      assertEquals(result.get("cp2")?.status, "offline");
    });

    it("should default missing fields to zero/unknown", async () => {
      /* @Given a node without optional fields */
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({ resources: [{ type: "node", node: "cp1" }] }),
      );

      /* @When liveNodes is called */
      const result = await adapter.liveNodes();

      /* @Then defaults should be applied */
      const cp1 = result.get("cp1")!;
      assertEquals(cp1.status, "unknown");
      assertEquals(cp1.cpuCores, 0);
      assertEquals(cp1.cpuPercent, 0);
      assertEquals(cp1.ramUsedGiB, 0);
      assertEquals(cp1.ramTotalGiB, 0);
      assertEquals(cp1.diskUsedGiB, 0);
      assertEquals(cp1.diskTotalGiB, 0);
      assertEquals(cp1.uptimeSeconds, 0);
    });

    it("should propagate integration errors", async () => {
      /* @Given an integration that rejects */
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({
          resources: () => {
            throw new Error("boom");
          },
        }),
      );

      /* @When liveNodes is called @Then it should propagate */
      await assertRejects(() => adapter.liveNodes(), Error, "boom");
    });
  });

  describe("liveVirtualMachines", () => {
    it("should map qemu resources of the requested node keyed by virtualMachineId", async () => {
      /* @Given /cluster/resources with qemus on different nodes */
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({
          resources: [
            { type: "node", node: "cp1" },
            {
              type: "qemu",
              node: "cp1",
              vmid: 101,
              status: "running",
              cpu: 0.25,
              maxcpu: 2,
              mem: 1 * 1024 * 1024 * 1024,
              maxmem: 2 * 1024 * 1024 * 1024,
            },
            { type: "qemu", node: "cp2", vmid: 201 }, // different node — excluded from result
            { type: "qemu", node: "cp1" }, // no vmid — ignored
          ],
        }),
      );

      /* @When liveVirtualMachines is called for cp1 */
      const result = await adapter.liveVirtualMachines("cp1");

      /* @Then it should contain only qemus from cp1 with vmid */
      assertEquals(result.size, 1);
      const vm = result.get(101)!;
      assertEquals(vm.status, "running");
      assertEquals(vm.cpuCores, 2);
      assertEquals(vm.cpuPercent, 25);
      assertEquals(vm.ramUsedGiB, 1);
      assertEquals(vm.ramTotalGiB, 2);
    });
  });

  describe("storages", () => {
    it("should map NodeStorage to ProxmoxStorageRecord", async () => {
      /* @Given a /nodes/cp1/storage response */
      const calls: { node: string }[] = [];
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({
          storageCalls: calls,
          storages: [
            { storage: "local-lvm", type: "lvmthin", avail: 100, total: 500 },
            { storage: "ceph", type: "rbd" }, // no avail/total — defaults to 0
          ],
        }),
      );

      /* @When storages is called */
      const result = await adapter.storages("cp1");

      /* @Then it should map id/type/available/total and default to 0 */
      assertEquals(calls, [{ node: "cp1" }]);
      assertEquals(result.length, 2);
      assertEquals(result[0], { id: "local-lvm", type: "lvmthin", available: 100, total: 500 });
      assertEquals(result[1], { id: "ceph", type: "rbd", available: 0, total: 0 });
    });
  });

  describe("vmMetrics", () => {
    it("should forward node/virtualMachineId/timeframe and map raw points", async () => {
      /* @Given a series of RRD points */
      const calls: {
        node: string;
        virtualMachineId: number;
        timeframe: ProxmoxMetricsTimeframe;
      }[] = [];
      const adapter = new ProxmoxApiAdapter(
        CONFIG,
        fakeIntegration({
          metricsCalls: calls,
          metrics: [
            {
              time: 1_700_000_000,
              cpu: 0.42,
              mem: 2 * 1024 * 1024 * 1024,
              maxmem: 8 * 1024 * 1024 * 1024,
              diskread: 1 * 1024 * 1024,
              diskwrite: 2 * 1024 * 1024,
              netin: 3 * 1024 * 1024,
              netout: 4 * 1024 * 1024,
            },
            { time: 1_700_000_060 }, // empty data point (gap) — all metrics default to 0
          ],
        }),
      );

      /* @When vmMetrics is called */
      const result = await adapter.vmMetrics("cp1", 101, "hour");

      /* @Then it should pass args through and convert units */
      assertEquals(calls, [{ node: "cp1", virtualMachineId: 101, timeframe: "hour" }]);
      assertEquals(result.length, 2);
      assertEquals(result[0], {
        time: 1_700_000_000,
        cpuPercent: 42,
        ramUsedGiB: 2,
        ramTotalGiB: 8,
        diskReadMBs: 1,
        diskWriteMBs: 2,
        netInMBs: 3,
        netOutMBs: 4,
      });
      assertEquals(result[1], {
        time: 1_700_000_060,
        cpuPercent: 0,
        ramUsedGiB: 0,
        ramTotalGiB: 0,
        diskReadMBs: 0,
        diskWriteMBs: 0,
        netInMBs: 0,
        netOutMBs: 0,
      });
    });
  });
});
