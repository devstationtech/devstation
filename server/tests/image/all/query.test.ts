import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/images/all/query.ts";

/**
 * The cluster `images/all` read model lists image *assignments* — one record
 * per (node, image) template, built from the per-node snapshot. The central
 * catalog itself lives in the `images` context, so this query no longer reads
 * (or returns) catalog rows.
 */
describe("query/image/all", () => {
  let dir: string;
  let query: Query;

  beforeEach(() => {
    dir = Deno.makeTempDirSync();
    query = new Query(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  const writeClusters = (content: unknown) =>
    writeFile(join(dir, "clusters.json"), JSON.stringify(content, null, 2), "utf-8");

  it("should return empty list when clusters file does not exist", async () => {
    /* @Given no clusters.json */
    /* @When the query is executed */
    const result = await query.execute();
    /* @Then it should return an empty list */
    assertEquals(result, []);
  });

  it("should return empty list when no node has an assignment", async () => {
    /* @Given a cluster with a node but no image assignment */
    await writeClusters([
      {
        id: "c1",
        name: "homelab",
        nodes: [{ id: "n1", name: "cp1", images: [], virtualMachines: [] }],
      },
    ]);

    /* @When the query is executed */
    const result = await query.execute();

    /* @Then it returns nothing */
    assertEquals(result, []);
  });

  it("should return one record per node assignment with its snapshot + materialization", async () => {
    /* @Given a cluster with two nodes, each carrying an assignment */
    await writeClusters([
      {
        id: "c1",
        name: "homelab",
        nodes: [
          {
            id: "n1",
            name: "cp1",
            images: [{
              imageId: "tpl-1",
              name: "ubuntu-24",
              os: "ubuntu-22-04",
              sourceUrl: "https://example.com/noble.img",
              virtualMachineId: 9000,
              storage: "s1",
            }],
            virtualMachines: [],
          },
          {
            id: "n2",
            name: "cp2",
            images: [{
              imageId: "tpl-2",
              name: "debian-12",
              os: "debian-12",
              sourceUrl: "https://example.com/bookworm.img",
              virtualMachineId: 9001,
              storage: "s2",
            }],
            virtualMachines: [],
          },
        ],
      },
    ]);

    /* @When the query is executed */
    const result = await query.execute();

    /* @Then both assignments come back with their snapshot + node context */
    assertEquals(result.length, 2);
    assertEquals(result[0].imageId, "tpl-1");
    assertEquals(result[0].name, "ubuntu-24");
    assertEquals(result[0].clusterName, "homelab");
    assertEquals(result[0].nodeName, "cp1");
    assertEquals(result[0].virtualMachineId, 9000);
    assertEquals(result[0].storage, "s1");
    assertEquals(result[1].imageId, "tpl-2");
    assertEquals(result[1].nodeName, "cp2");
  });

  it("should filter by clusterId when provided", async () => {
    /* @Given two clusters each with an assignment */
    await writeClusters([
      {
        id: "c1",
        name: "homelab",
        nodes: [{
          id: "n1",
          name: "cp1",
          images: [{
            imageId: "tpl-1",
            name: "ubuntu-24",
            os: "ubuntu-22-04",
            sourceUrl: "https://x/a.img",
            virtualMachineId: 9000,
            storage: "s1",
          }],
          virtualMachines: [],
        }],
      },
      {
        id: "c2",
        name: "prod",
        nodes: [{
          id: "n2",
          name: "cp2",
          images: [{
            imageId: "tpl-2",
            name: "debian-12",
            os: "debian-12",
            sourceUrl: "https://x/b.img",
            virtualMachineId: 9001,
            storage: "s2",
          }],
          virtualMachines: [],
        }],
      },
    ]);

    /* @When the query is executed filtering by c1 */
    const result = await query.execute("c1");

    /* @Then it should return only c1's assignment */
    assertEquals(result.length, 1);
    assertEquals(result[0].clusterId, "c1");
  });
});
