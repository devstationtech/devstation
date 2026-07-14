import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/images/application/queries/all/query.ts";
import { Adapter as ImageUsagesAdapter } from "@server/images/outbound/persistence/file-system/image-usages-adapter.ts";
import { ImageUsage } from "@server/images/domain/models/usage/image-usage.ts";
import { Id } from "@server/images/domain/models/id.ts";

/**
 * The catalog list query joins each image with its usage projection so the UI
 * shows a usage count and can warn before a delete.
 */
const IMG = "00000000-0000-0000-0000-0000000000a1";

describe("query/images/all — catalog with usage", () => {
  let dir: string;
  let query: Query;
  let usages: ImageUsagesAdapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "images-all-" });
    const fs = new FileSystem(dir);
    usages = new ImageUsagesAdapter(fs);
    query = new Query(fs, usages);
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  const writeCatalog = (rows: unknown[]) =>
    writeFile(join(dir, "images.json"), JSON.stringify(rows, null, 2), "utf-8");

  it("returns catalog rows with an empty usages list when unused", async () => {
    await writeCatalog([
      { id: IMG, name: "ubuntu-22", os: "ubuntu-22-04", sourceUrl: "https://x/a.img", version: 1 },
    ]);
    const result = await query.execute();
    assertEquals(result.length, 1);
    assertEquals(result[0].usages, []);
  });

  it("attaches the usage slots (cluster/node) recorded for an image", async () => {
    await writeCatalog([
      { id: IMG, name: "ubuntu-22", os: "ubuntu-22-04", sourceUrl: "https://x/a.img", version: 1 },
    ]);
    await usages.record(new ImageUsage(new Id(IMG), "c1", "homelab", "n1", "cp4"));
    const result = await query.execute();
    assertEquals(result[0].usages.length, 1);
    assertEquals(result[0].usages[0].clusterName, "homelab");
    assertEquals(result[0].usages[0].nodeName, "cp4");
  });
});
