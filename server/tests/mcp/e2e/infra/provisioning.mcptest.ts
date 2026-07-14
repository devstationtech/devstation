/**
 * SIDE-EFFECT — provisioning lifecycle against a real node (runs OpenTofu
 * through the engine; opt-in, slow). Core lifecycle first (plan→apply→
 * destroy), then the cancel coverage last (a cancelled plan wedges the node
 * in transient PLAN_STARTED, so it must follow the lifecycle).
 *
 * Endpoints: provisioning_plan, execution_watch, execution_cancel,
 *   node_acknowledge_interruption; provisioning_apply/_destroy gated by
 *   DEVSTATION_E2E_DESTRUCTIVE=1 (they create/destroy real VMs).
 *
 * Without a reachable lab the lifecycle test ignores — never fails.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { resolveLive } from "../live.ts";
import type { McpClient } from "@mcp-test-harness-ts/mod.ts";

const DESTRUCTIVE = Deno.env.get("DEVSTATION_E2E_DESTRUCTIVE") === "1";

interface Started {
  readonly executionId: string;
}

/** Watches an execution to its terminal and asserts it Succeeded. */
async function watchSucceeds(client: () => McpClient, executionId: string) {
  const r = await client().parsed<{ events?: { kind?: string; type?: string }[] }>(
    "devstation_execution_watch",
    { executionId },
  );
  const terminal = (r.events ?? []).at(-1);
  const kind = terminal?.kind ?? terminal?.type ?? "";
  assert(/succeed/i.test(kind), `expected a Succeeded terminal, got '${kind}'`);
}

describe("Provisioning lifecycle", () => {
  const client = mcp();

  it("previews, plans, (apply/destroy when destructive), and covers cancel", async () => {
    /* @Given the live lab cluster + its first node */
    const { cluster, node } = await resolveLive(client());
    if (!cluster || !node) return; // no reachable lab cluster/node — nothing to exercise
    const nodeIds = [node.id];

    /* @Given the provisioning preview answers */
    await client().parsed("devstation_cluster_provision_preview", { clusterId: cluster.id });

    /* @When a provisioning plan runs @Then it watches to a Succeeded terminal */
    const plan = await client().parsed<Started>(
      "devstation_cluster_provisioning_plan",
      { clusterId: cluster.id, nodeIds },
    );
    if (plan?.executionId) await watchSucceeds(client, plan.executionId);

    /* @When destructive: apply creates real VMs @Then it watches to Succeeded */
    if (DESTRUCTIVE) {
      const apply = await client().parsed<Started>(
        "devstation_cluster_provisioning_apply",
        { clusterId: cluster.id, nodeIds },
      );
      if (apply?.executionId) await watchSucceeds(client, apply.executionId);

      /* @When destroy tears the VMs down @Then it watches to Succeeded */
      const destroy = await client().parsed<Started>(
        "devstation_cluster_provisioning_destroy",
        { clusterId: cluster.id, nodeIds },
      );
      if (destroy?.executionId) await watchSucceeds(client, destroy.executionId);
    }

    // Cancel coverage LAST: cancelling a plan leaves the node wedged in the
    // transient PLAN_STARTED. A fast plan can finish before the cancel lands,
    // so the terminal kind is tolerated. Recovery = acknowledge (→ PLAN_FAILED,
    // a re-plannable resting state); we don't chase a re-plan (the cancelled
    // plan's handler settles async and would race a follow-up completePlan).
    /* @When a plan is started and then cancelled */
    const toCancel = await client().parsed<Started>(
      "devstation_cluster_provisioning_plan",
      { clusterId: cluster.id, nodeIds },
    );
    if (toCancel?.executionId) {
      await client().parsed("devstation_execution_cancel", { executionId: toCancel.executionId });
      /* @Then watch it to a terminal (kind tolerated) */
      await client().parsed<{ events?: { kind?: string; type?: string }[] }>(
        "devstation_execution_watch",
        { executionId: toCancel.executionId },
      );
    }

    /* @Then acknowledge the interruption (recover → PLAN_FAILED) — tolerate a
       non-interrupted node, the ack is recovery not the assertion */
    try {
      await client().parsed("devstation_cluster_node_acknowledge_interruption", {
        clusterId: cluster.id,
        nodeId: node.id,
      });
    } catch {
      // node wasn't interrupted — nothing to recover, fine.
    }
  });

  if (!DESTRUCTIVE) {
    it.ignore("apply/destroy (set DEVSTATION_E2E_DESTRUCTIVE=1)", () => {});
  }
});
