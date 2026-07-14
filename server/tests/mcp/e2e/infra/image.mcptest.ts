/**
 * SIDE-EFFECT — materialize an image on a real node over SSH (downloads/
 * converts a real image; opt-in, slow).
 *
 * Endpoints: image_create, execution_watch. Skips when no reachable lab
 * node or no image in the cluster catalog.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { resolveLive } from "../live.ts";
import type { McpClient } from "@mcp-test-harness-ts/mod.ts";

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

describe("Image materialize", () => {
  const client = mcp();

  it("materializes the first catalog image on the live node over SSH", async () => {
    /* @Given the live lab cluster + its first node */
    const { cluster, node } = await resolveLive(client());
    if (!cluster || !node) return; // no reachable lab cluster/node

    /* @Given the first image in the cluster catalog */
    const images = await client().parsed<{ id: string }[]>(
      "devstation_cluster_images_list",
      { clusterId: cluster.id },
    );
    const imageId = images[0]?.id;
    if (!imageId) return; // no image in the cluster catalog to materialize

    /* @When the image is materialized on the node over SSH */
    const started = await client().parsed<Started>("devstation_cluster_image_create", {
      clusterId: cluster.id,
      nodeId: node.id,
      imageId,
    });

    /* @Then the materialize execution watches to a Succeeded terminal */
    if (started?.executionId) await watchSucceeds(client, started.executionId);
  });
});
