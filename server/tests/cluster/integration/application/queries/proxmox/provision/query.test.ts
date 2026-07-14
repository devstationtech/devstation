import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/proxmox/provision/query.ts";

describe("query/cluster/provision", () => {
  let dir: string;
  let query: Query;

  beforeEach(() => {
    dir = Deno.makeTempDirSync();
    query = new Query(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  const writeJson = (file: string, content: unknown) =>
    writeFile(join(dir, file), JSON.stringify(content, null, 2), "utf-8");

  it("should return null when cluster does not exist", async () => {
    /* @Given no clusters.json */
    /* @When the query is executed */
    const result = await query.execute("missing");
    /* @Then it should return null */
    assertEquals(result, null);
  });

  it("should return topology with VMs grouped per node and free tags", async () => {
    /* @Given a cluster with two nodes; the first has VMs with free tags */
    await writeJson("clusters.json", [
      {
        id: "c1",
        name: "homelab",
        connection: { host: "10.0.0.1", vaultId: "v1", secretId: "s1" },
        nodes: [
          {
            id: "n1",
            name: "cp1",
            address: "10.0.0.11",
            credential: { vaultId: "v1", usernameSecretId: "u1", passwordSecretId: "p1" },
            images: [{
              imageId: "tpl-1",
              name: "ubuntu-24",
              virtualMachineId: 9000,
              storage: "local-lvm",
            }],
            virtualMachines: [
              {
                id: 101,
                name: "web-prod-1",
                tags: ["web", "prod"],
                image: "tpl-1",
                address: "10.0.1.10",
                gateway: "10.0.1.1",
                dns: "1.1.1.1",
                storage: "local-lvm",
                resources: { cpu: 2, ram: 2048, disk: 20 },
              },
              {
                id: 102,
                name: "web-dev-1",
                tags: ["web", "dev"],
                image: "tpl-1",
                address: "10.0.2.10",
                gateway: "10.0.2.1",
                dns: "1.1.1.1",
                storage: "local-lvm",
                resources: { cpu: 1, ram: 1024, disk: 10 },
              },
            ],
          },
          {
            id: "n2",
            name: "cp2",
            address: "10.0.0.12",
            credential: {
              vaultId: "00000000-0000-0000-0000-000000000000",
              usernameSecretId: "00000000-0000-0000-0000-000000000000",
              passwordSecretId: "00000000-0000-0000-0000-000000000000",
            },
            images: [],
            virtualMachines: [],
          },
        ],
      },
    ]);
    /* @When the query is executed */
    const result = await query.execute("c1");

    /* @Then it should return the topology with VMs per node + tags */
    assertEquals(result?.clusterName, "homelab");
    assertEquals(result?.connected, true);
    assertEquals(result?.nodes.length, 2);

    const cp1 = result!.nodes[0];
    assertEquals(cp1.name, "cp1");
    assertEquals(cp1.ip, "10.0.0.11");
    assertEquals(cp1.hasCredential, true);
    assertEquals(cp1.virtualMachines.length, 2);
    assertEquals(cp1.virtualMachines[0].name, "web-prod-1");
    assertEquals(cp1.virtualMachines[0].tags, ["web", "prod"]);
    assertEquals(cp1.virtualMachines[0].imageName, "ubuntu-24");
    assertEquals(cp1.virtualMachines[1].name, "web-dev-1");
    assertEquals(cp1.virtualMachines[1].tags, ["web", "dev"]);

    const cp2 = result!.nodes[1];
    assertEquals(cp2.hasCredential, false);
    assertEquals(cp2.virtualMachines.length, 0);
  });

  it("should mark cluster as not connected when no proxmox connection exists", async () => {
    /* @Given a cluster without connections */
    await writeJson("clusters.json", [
      { id: "c1", name: "isolated", connection: null, nodes: [] },
    ]);
    await writeJson("roles.json", []);
    await writeJson("environments.json", []);

    /* @When the query is executed */
    const result = await query.execute("c1");

    /* @Then it should return connected=false */
    assertEquals(result?.connected, false);
  });
});
