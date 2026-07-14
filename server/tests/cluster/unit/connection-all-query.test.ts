import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as ConnectionAllQuery } from "@server/cluster/application/queries/proxmox/connection/all/query.ts";

/**
 * `cluster.proxmox.connections.list` query — returns zero or one
 * connection row. Pins the three branches: cluster missing, cluster
 * without a connection, and the policy-default fallback (legacy
 * connections persisted before `policy` existed default to
 * cloneStrategy=auto / parallelism=1).
 */

async function withClusters<T>(
  raw: unknown,
  fn: (q: ConnectionAllQuery) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "conn-all-query-" });
  try {
    await Deno.writeTextFile(join(dir, "clusters.json"), JSON.stringify(raw));
    return await fn(new ConnectionAllQuery(new FileSystem(dir)));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

describe("ConnectionAllQuery.execute", () => {
  it("returns [] when the cluster id is not found", async () => {
    const rows = await withClusters(
      [{ id: "other", connection: { host: "x" } }],
      (q) => q.execute("missing"),
    );
    assertEquals(rows, []);
  });

  it("returns [] when the cluster exists but has no connection", async () => {
    /* @Given a registered-but-unconnected cluster */
    const rows = await withClusters([{ id: "c1" }], (q) => q.execute("c1"));
    /* @Then no connection row — never throws */
    assertEquals(rows, []);
  });

  it("exposes the resolved connection with its explicit policy", async () => {
    /* @Given a connection carrying an explicit provisioning policy */
    const rows = await withClusters(
      [{
        id: "c1",
        connection: {
          host: "proxmox.example.com",
          vaultId: "v1",
          secretId: "s1",
          policy: { cloneStrategy: "linked", parallelism: 4 },
        },
      }],
      (q) => q.execute("c1"),
    );
    /* @Then the row carries the explicit policy values verbatim */
    assertEquals(rows.length, 1);
    assertEquals(rows[0].host, "proxmox.example.com");
    assertEquals(rows[0].cloneStrategy, "linked");
    assertEquals(rows[0].parallelism, 4);
  });

  it("defaults policy to auto/1 for a legacy connection without `policy`", async () => {
    /* @Given a connection persisted before `policy` existed */
    const rows = await withClusters(
      [{ id: "c1", connection: { host: "legacy.example.com", vaultId: "v1", secretId: "s1" } }],
      (q) => q.execute("c1"),
    );
    /* @Then the query degrades to the universal-safe defaults */
    assertEquals(rows[0].cloneStrategy, "auto");
    assertEquals(rows[0].parallelism, 1);
  });
});
