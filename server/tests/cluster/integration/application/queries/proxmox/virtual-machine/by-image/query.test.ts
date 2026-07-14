import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/query.ts";

describe("query/cluster/virtual-machine/by-image", () => {
  let dir: string;
  let query: Query;

  beforeEach(() => {
    dir = Deno.makeTempDirSync();
    query = new Query(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  const writeClusters = (content: unknown) =>
    writeFile(join(dir, "clusters.json"), JSON.stringify(content, null, 2), "utf-8");

  it("should return empty list when no clusters file exists", async () => {
    /* @Given no clusters.json */
    /* @When the query is executed */
    const result = await query.execute("uuid-9000");
    /* @Then it should return an empty list */
    assertEquals(result, []);
  });

  it("should return empty list when no virtual machine references the image", async () => {
    /* @Given a cluster without references to the image */
    await writeClusters([
      {
        id: "c1",
        name: "cluster-1",
        nodes: [
          {
            id: "n1",
            name: "node-1",
            virtualMachines: [{ id: 100, name: "vm1", image: "uuid-9001" }],
          },
        ],
      },
    ]);

    /* @When the query is executed */
    const result = await query.execute("uuid-9000");

    /* @Then it should return an empty list */
    assertEquals(result, []);
  });

  it("should return virtual machines that reference the image across clusters", async () => {
    /* @Given two clusters with virtual machines referencing the image */
    await writeClusters([
      {
        id: "c1",
        name: "cluster-1",
        nodes: [
          {
            id: "n1",
            name: "node-1",
            virtualMachines: [
              { id: 100, name: "vm1", image: "uuid-9000" },
              { id: 101, name: "vm2", image: "uuid-9001" },
            ],
          },
        ],
      },
      {
        id: "c2",
        name: "cluster-2",
        nodes: [
          {
            id: "n2",
            name: "node-2",
            virtualMachines: [{ id: 102, name: "vm3", image: "uuid-9000" }],
          },
        ],
      },
    ]);

    /* @When the query is executed */
    const result = await query.execute("uuid-9000");

    /* @Then it should return 2 virtual machines */
    assertEquals(result.length, 2);
    assertEquals(result[0].clusterId, "c1");
    assertEquals(result[0].virtualMachineName, "vm1");
    assertEquals(result[1].clusterId, "c2");
    assertEquals(result[1].virtualMachineName, "vm3");
  });
});
