/**
 * Image catalog management e2e — every image MCP endpoint over a real server,
 * one happy path: register → list → update → remove. Pure catalog (no infra),
 * self-cleaning.
 *
 * Endpoints: image_register, _list, _update, _remove.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { IMAGE } from "../fixtures.ts";

interface ImageRow {
  readonly id: string;
  readonly name: string;
  readonly os: string;
  readonly sourceUrl: string;
  readonly usages: { clusterName: string; nodeName: string }[];
}

describe("Image catalog management", () => {
  const client = mcp();

  it("registers an image, lists it, updates it, and cleans up", async () => {
    /* @Given a registered catalog image */
    const { imageId } = await client().parsed<{ imageId: string }>(
      "devstation_image_register",
      { ...IMAGE },
    );
    assert(imageId, "register should echo the new image id");

    /* @Then it appears in the catalog with an empty usage list */
    const listed = await client().parsed<ImageRow[]>("devstation_image_list", {});
    const mine = listed.find((i) => i.id === imageId);
    assert(mine, "registered image should be listed");
    assert(Array.isArray(mine.usages) && mine.usages.length === 0, "a fresh image has no usage");

    /* @When the image source is updated */
    await client().parsed("devstation_image_update", {
      id: imageId,
      ...IMAGE,
      sourceUrl: "https://example.invalid/e2e-image-v2.qcow2",
    });

    /* @When the image is removed from the catalog */
    await client().parsed("devstation_image_unregister", { id: imageId });

    /* @Then it is gone */
    const remaining = await client().parsed<ImageRow[]>("devstation_image_list", {});
    assert(!remaining.some((i) => i.id === imageId), "removed image should be gone");
  });
});
