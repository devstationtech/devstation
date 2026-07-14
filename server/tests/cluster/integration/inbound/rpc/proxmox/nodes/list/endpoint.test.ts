import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxNodesListResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as AllNodesQuery } from "@server/cluster/application/queries/proxmox/node/all/query.ts";
import { ListProxmoxNodesEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/list/endpoint.ts";
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

function fakeApi(liveByName: Map<string, ProxmoxLiveResources>): ProxmoxReadApi {
  return {
    liveNodes: () => Promise.resolve(liveByName),
  } as unknown as ProxmoxReadApi;
}

function spyLogger(): { logger: Logger; warns: string[] } {
  const warns: string[] = [];
  return {
    warns,
    logger: {
      info: async () => {},
      // deno-lint-ignore require-await -- stub satisfies the async Logger port
      warn: async (_o, m) => {
        warns.push(m);
      },
      error: async () => {},
    },
  };
}

const aProxmoxCluster = (nodeName: string) => ({
  provider: "proxmox" as const,
  id: "c1",
  name: "homelab",
  version: 1,
  creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
  connection: { host: "10.0.0.5", vaultId: "v", secretId: "s" },
  nodes: [{
    id: "n1",
    name: nodeName,
    address: "10.0.0.10",
    credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
    images: [],
    virtualMachines: [],
  }],
});

function buildRpc(query: AllNodesQuery): Client {
  const endpoint = new ListProxmoxNodesEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.nodes.list endpoint — integration", () => {
  it("returns empty array when cluster is missing", async () => {
    /* @Given no clusters persisted */
    const persistence = new Persistence();
    try {
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));
      /* @When nodes are listed for an unknown cluster */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "missing" },
      );
      /* @Then an empty list is returned */
      assertEquals(response, []);
    } finally {
      await persistence.teardown();
    }
  });

  it("returns static records (no live) when cluster has no connection", async () => {
    /* @Given a persisted cluster with one node and no connection */
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
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );
      /* @Then the node is returned disconnected, with no live data and a default state */
      assertEquals(response.length, 1);
      assertEquals(response[0].name, "node-1");
      assertEquals(response[0].resources.connected, false);
      assertEquals(response[0].resources.live, undefined);
      // legacy rows without a persisted state default to REGISTERED
      assertEquals(response[0].state, "REGISTERED");
    } finally {
      await persistence.teardown();
    }
  });

  it("propagates the node FSM state (UI gates VM mutations while in-flight)", async () => {
    /* @Given a persisted node in a transient APPLY_STARTED state */
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
            state: "APPLY_STARTED",
          }],
        },
      ]);
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );
      /* @Then the FSM state is propagated and a transient state is flagged interrupted */
      assertEquals(response[0].state, "APPLY_STARTED");
      // Transient states derive interrupted=true on fresh load.
      assertEquals(response[0].interrupted, true);
    } finally {
      await persistence.teardown();
    }
  });

  /**
   * A fresh load of `clusters.json` cannot tell whether a transient
   * state has a live execution backing it; if any does (in-process),
   * we accept the false positive. The projection surfaces `interrupted`
   * for the three transient states only; non-transient states must NOT
   * be flagged.
   */
  it("only flags the three transient states as interrupted", async () => {
    /* @Given one node per FSM state, with the expected interrupted flag */
    const persistence = new Persistence();
    try {
      const cases: Array<[string, boolean]> = [
        ["REGISTERED", false],
        ["PLAN_STARTED", true],
        ["PLAN_SUCCEEDED", false],
        ["PLAN_FAILED", false],
        ["APPLY_STARTED", true],
        ["APPLY_SUCCEEDED", false],
        ["APPLY_FAILED", false],
        ["DESTROY_STARTED", true],
        ["DESTROY_SUCCEEDED", false],
        ["DESTROY_FAILED", false],
      ];
      await persistence.writeClusters([
        {
          provider: "proxmox",
          id: "c1",
          name: "homelab",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          nodes: cases.map(([state], i) => ({
            id: `n${i}`,
            name: `node-${i}`,
            address: `10.0.0.${i + 10}`,
            credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
            images: [],
            virtualMachines: [],
            state,
          })),
        },
      ]);
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );
      /* @Then only the three transient states derive interrupted=true */
      for (let i = 0; i < cases.length; i++) {
        const [state, expected] = cases[i];
        assertEquals(response[i].state, state);
        assertEquals(
          response[i].interrupted,
          expected,
          `${state} should derive interrupted=${expected}`,
        );
      }
    } finally {
      await persistence.teardown();
    }
  });

  it("degrades to static records when provider setup throws (never throws)", async () => {
    // The real failure that blanked the cluster screen: apiFactory.create
    // rejects (e.g. secret resolution fails) and the rejection escapes the
    // query, so cluster.proxmox.nodes.list errors and the UI shows nothing.
    /* @Given a connected cluster but an api factory that rejects on setup */
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
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.reject(new Error("secret resolution failed")),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );
      /* @Then the query degrades to static records instead of throwing */
      assertEquals(response.length, 1);
      assertEquals(response[0].name, "node-1");
      assertEquals(response[0].resources.connected, false);
    } finally {
      await persistence.teardown();
    }
  });

  it("merges live resources when api is reachable", async () => {
    /* @Given a connected cluster and an api returning live node resources */
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
      const live: ProxmoxLiveResources = {
        status: "online",
        cpuCores: 8,
        cpuPercent: 12.5,
        ramUsedGiB: 4,
        ramTotalGiB: 16,
        diskUsedGiB: 100,
        diskTotalGiB: 500,
        uptimeSeconds: 3600,
      };
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map([["node-1", live]]))),
      };
      const rpc = buildRpc(new AllNodesQuery(fs, factory));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );
      /* @Then live resources are merged onto the connected node */
      assertEquals(response.length, 1);
      assertEquals(response[0].resources.connected, true);
      assertEquals(response[0].resources.live?.cpuCores, 8);
    } finally {
      await persistence.teardown();
    }
  });

  it("warns about likely token permissions when Proxmox returns 0 nodes", async () => {
    // The real bug: connection 'connected', but every node shows zeros and
    // nothing is logged. /cluster/resources returns 200 with an empty data
    // array when the API token lacks read access — silent degradation.
    /* @Given a connected cluster whose api reports zero live nodes */
    const persistence = new Persistence();
    try {
      await persistence.writeClusters([aProxmoxCluster("cp4")]);
      const fs = new FileSystem(persistence.dir);
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map())),
      };
      const { logger, warns } = spyLogger();
      const rpc = buildRpc(new AllNodesQuery(fs, factory, logger));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );

      /* @Then the node stays disconnected and a token-permission warning is logged */
      assertEquals(response.length, 1);
      assertEquals(response[0].resources.connected, false);
      assertEquals(warns.length, 1);
      assertStringIncludes(warns[0], "0 nodes");
      assertStringIncludes(warns[0], "token");
      assertStringIncludes(warns[0], "cp4");
    } finally {
      await persistence.teardown();
    }
  });

  it("warns with the available Proxmox node names when the name doesn't match", async () => {
    /* @Given a cluster node named cp4 but live resources keyed under pve */
    const persistence = new Persistence();
    try {
      await persistence.writeClusters([aProxmoxCluster("cp4")]);
      const fs = new FileSystem(persistence.dir);
      const live: ProxmoxLiveResources = {
        status: "online",
        cpuCores: 4,
        cpuPercent: 10,
        ramUsedGiB: 2,
        ramTotalGiB: 8,
        diskUsedGiB: 10,
        diskTotalGiB: 100,
        uptimeSeconds: 60,
      };
      const factory: ProxmoxReadApiFactory = {
        create: () => Promise.resolve(fakeApi(new Map([["pve", live]]))),
      };
      const { logger, warns } = spyLogger();
      const rpc = buildRpc(new AllNodesQuery(fs, factory, logger));

      /* @When nodes are listed */
      const response = await rpc.invoke<ClusterProxmoxNodesListResponse>(
        "cluster.proxmox.nodes.list",
        { sessionId: STUB_SESSION_ID, clusterId: "c1" },
      );

      /* @Then the node stays disconnected and the warning names both the expected and available nodes */
      assertEquals(response[0].resources.connected, false);
      assertEquals(warns.length, 1);
      assertStringIncludes(warns[0], "cp4");
      assertStringIncludes(warns[0], "pve");
    } finally {
      await persistence.teardown();
    }
  });
});
