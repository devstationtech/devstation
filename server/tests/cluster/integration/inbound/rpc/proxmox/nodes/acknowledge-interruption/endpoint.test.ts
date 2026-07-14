import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ClusterProxmoxNodesAcknowledgeInterruptionResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

/**
 * Integration test for `cluster.proxmox.nodes.acknowledgeInterruption`
 * end-to-end through the RPC client → handler → aggregate → persistence
 * → list query (interrupted flag flips with the state).
 *
 * Mirrors the existing unregister/list integration tests so it picks up
 * the same regression net (auth, RPC envelope, sessionId injection).
 */
describe("cluster.proxmox.nodes.acknowledgeInterruption endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterEach(() => persistence.teardown());

  // Seeds a single-cluster, single-node clusters.json fixture with the
  // given transient state — the persisted form a process restart would
  // load. The node has no virtualMachines/images so the aggregate
  // invariants stay satisfied for ack alone.
  async function seedAt(state: string): Promise<{ clusterId: string; nodeId: string }> {
    const clusterId = "00000000-0000-0000-0000-000000000001";
    const nodeId = "00000000-0000-0000-0000-000000000010";
    await persistence.writeClusters([
      {
        provider: "proxmox",
        id: clusterId,
        name: "homelab",
        version: 3,
        creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        nodes: [{
          id: nodeId,
          name: "node-1",
          address: "10.0.0.10",
          credential: {
            vaultId: "00000000-0000-0000-0000-000000000020",
            usernameSecretId: "00000000-0000-0000-0000-000000000021",
            passwordSecretId: "00000000-0000-0000-0000-000000000022",
          },
          images: [],
          virtualMachines: [],
          state,
        }],
      },
      // deno-lint-ignore no-explicit-any
    ] as any);
    return { clusterId, nodeId };
  }

  async function stateOf(clusterId: string): Promise<string> {
    const clusters = await persistence.readClusters();
    return clusters.find((c) => c.id === clusterId)!.nodes[0].state ?? "REGISTERED";
  }

  it("demotes APPLY_STARTED to APPLY_FAILED on acknowledge", async () => {
    /* @Given a node persisted in APPLY_STARTED (a real restart leaves it here) */
    const { clusterId, nodeId } = await seedAt("APPLY_STARTED");
    assertEquals(await stateOf(clusterId), "APPLY_STARTED");

    /* @When the operator acknowledges via the RPC endpoint */
    await rpc.invoke<ClusterProxmoxNodesAcknowledgeInterruptionResponse>(
      "cluster.proxmox.nodes.acknowledgeInterruption",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId },
    );

    /* @Then the persisted state demotes to APPLY_FAILED so retry/replan/destroy apply */
    assertEquals(await stateOf(clusterId), "APPLY_FAILED");
  });

  it("demotes PLAN_STARTED to PLAN_FAILED", async () => {
    /* @Given a node persisted in PLAN_STARTED */
    const { clusterId, nodeId } = await seedAt("PLAN_STARTED");
    /* @When acknowledged */
    await rpc.invoke<ClusterProxmoxNodesAcknowledgeInterruptionResponse>(
      "cluster.proxmox.nodes.acknowledgeInterruption",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId },
    );
    /* @Then the persisted state demotes to PLAN_FAILED */
    assertEquals(await stateOf(clusterId), "PLAN_FAILED");
  });

  it("demotes DESTROY_STARTED to DESTROY_FAILED", async () => {
    /* @Given a node persisted in DESTROY_STARTED */
    const { clusterId, nodeId } = await seedAt("DESTROY_STARTED");
    /* @When acknowledged */
    await rpc.invoke<ClusterProxmoxNodesAcknowledgeInterruptionResponse>(
      "cluster.proxmox.nodes.acknowledgeInterruption",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId },
    );
    /* @Then the persisted state demotes to DESTROY_FAILED (retry edge restored) */
    assertEquals(await stateOf(clusterId), "DESTROY_FAILED");
  });

  it("rejects acknowledge on a healthy non-transient state and leaves state untouched", async () => {
    /* @Given a node persisted in APPLY_SUCCEEDED (healthy) */
    const { clusterId, nodeId } = await seedAt("APPLY_SUCCEEDED");
    /* @When ack is called */
    /* @Then the RPC raises a domain error and the persisted state does NOT change */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxNodesAcknowledgeInterruptionResponse>(
          "cluster.proxmox.nodes.acknowledgeInterruption",
          { sessionId: STUB_SESSION_ID, clusterId, nodeId },
        ),
      Exception,
      "APPLY_SUCCEEDED",
    );
    assertEquals(await stateOf(clusterId), "APPLY_SUCCEEDED");
  });
});
