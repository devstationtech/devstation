/**
 * SIDE-EFFECT — install the DevStation automation public key on a real
 * node over SSH (mutates the node's authorized_keys; opt-in).
 *
 * Endpoint: connection_bootstrap_key. Skips when no reachable lab node.
 */
import { describe, it } from "@std/testing/bdd";
import { mcp } from "../harness.ts";
import { resolveLive } from "../live.ts";

describe("SSH bootstrap", () => {
  const client = mcp();

  it("installs the automation key on the live node over SSH", async () => {
    /* @Given the live lab cluster + its first node */
    const { cluster, node } = await resolveLive(client());
    if (!cluster || !node) return; // no reachable lab cluster/node

    /* @When the automation key is installed on the node over SSH */
    await client().parsed("devstation_cluster_connection_bootstrap_key", {
      clusterId: cluster.id,
      nodeId: node.id,
    });
  });
});
