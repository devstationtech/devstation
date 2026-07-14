import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Query } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";
import type { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";
import type { ClusterResource } from "@server/cluster/application/queries/proxmox/api/response/cluster-resource.ts";

function fakeIntegration(
  resources: ClusterResource[] | (() => never),
): ProxmoxIntegration {
  return {
    clusterResources: () => {
      if (typeof resources === "function") return resources();
      return Promise.resolve(resources);
    },
  } as unknown as ProxmoxIntegration;
}

describe("test-connection query", () => {
  it("should return ok with node count when integration succeeds", async () => {
    /* @Given an integration that returns nodes and qemus */
    const calls: { host: string; token: string }[] = [];
    const query = new Query((host, token) => {
      calls.push({ host, token });
      return fakeIntegration([
        { type: "node", node: "cp1" },
        { type: "node", node: "cp2" },
        { type: "qemu", node: "cp1", vmid: 100 },
      ]);
    });

    /* @When execute is called */
    const result = await query.execute("10.0.0.1", "tok");

    /* @Then it should return ok with the node count (qemus ignored) */
    assertEquals(result, { ok: true, nodeCount: 2 });
    assertEquals(calls, [{ host: "10.0.0.1", token: "tok" }]);
  });

  it("should return error when integration throws Error", async () => {
    /* @Given an integration that throws Error */
    const query = new Query(() =>
      fakeIntegration(() => {
        throw new Error("auth failed");
      })
    );

    /* @When execute is called */
    const result = await query.execute("10.0.0.1", "tok");

    /* @Then it should return error with the message */
    assertEquals(result, { ok: false, error: "auth failed" });
  });

  it("should fall back to default message for non-Error rejections", async () => {
    /* @Given an integration that rejects with something that is not Error */
    const query = new Query(() =>
      fakeIntegration(() => {
        throw "boom";
      })
    );

    /* @When execute is called */
    const result = await query.execute("10.0.0.1", "tok");

    /* @Then it should use the fallback message */
    assertEquals(result, { ok: false, error: "connection failed." });
  });

  it("should return zero node count when no nodes present", async () => {
    /* @Given an integration without nodes */
    const query = new Query(() => fakeIntegration([{ type: "qemu", vmid: 1 }]));

    /* @When execute is called */
    const result = await query.execute("10.0.0.1", "tok");

    /* @Then it should return ok with nodeCount = 0 */
    assertEquals(result, { ok: true, nodeCount: 0 });
  });
});
