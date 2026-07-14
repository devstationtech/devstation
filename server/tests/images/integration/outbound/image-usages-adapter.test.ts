import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter } from "@server/images/outbound/persistence/file-system/image-usages-adapter.ts";
import { ImageUsage } from "@server/images/domain/models/usage/image-usage.ts";
import { Id } from "@server/images/domain/models/id.ts";

/**
 * Usage projection persistence — the `ImageUsages` port over `image-usage.json`.
 * Pins idempotent record/forget keyed by the (image, cluster, node) slot and
 * the of/all reads the catalog list join relies on.
 */
const IMG_A = "00000000-0000-0000-0000-0000000000a1";
const IMG_B = "00000000-0000-0000-0000-0000000000a2";

function usage(imageId: string, cluster = "c1", node = "n1"): ImageUsage {
  return new ImageUsage(new Id(imageId), cluster, `${cluster}-name`, node, `${node}-name`);
}

describe("image usage projection Adapter", () => {
  let dir: string;
  let adapter: Adapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "image-usage-" });
    adapter = new Adapter(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  it("record then of round-trips a usage slot", async () => {
    await adapter.record(usage(IMG_A));
    const got = await adapter.of(new Id(IMG_A));
    assertEquals(got.length, 1);
    assertEquals(got[0].clusterName, "c1-name");
    assertEquals(got[0].nodeName, "n1-name");
  });

  it("record is idempotent on the same (image, cluster, node) slot", async () => {
    await adapter.record(usage(IMG_A, "c1", "n1"));
    await adapter.record(usage(IMG_A, "c1", "n1"));
    assertEquals((await adapter.of(new Id(IMG_A))).length, 1);
  });

  it("tracks the same image on different nodes as distinct slots", async () => {
    await adapter.record(usage(IMG_A, "c1", "n1"));
    await adapter.record(usage(IMG_A, "c1", "n2"));
    assertEquals((await adapter.of(new Id(IMG_A))).length, 2);
  });

  it("forget drops only the matching slot", async () => {
    await adapter.record(usage(IMG_A, "c1", "n1"));
    await adapter.record(usage(IMG_A, "c1", "n2"));
    await adapter.forget(new Id(IMG_A), "c1", "n1");
    const left = await adapter.of(new Id(IMG_A));
    assertEquals(left.length, 1);
    assertEquals(left[0].nodeId, "n2");
  });

  it("all returns every slot across images", async () => {
    await adapter.record(usage(IMG_A));
    await adapter.record(usage(IMG_B));
    assertEquals((await adapter.all()).length, 2);
  });
});
