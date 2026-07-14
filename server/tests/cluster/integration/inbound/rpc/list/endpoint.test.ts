import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterListResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("returns an empty list when nothing is registered", async () => {
    const response = await rpc.invoke<ClusterListResponse>("cluster.list", {
      sessionId: STUB_SESSION_ID,
    });
    assertEquals(response, []);
  });

  it("returns every registered cluster with its topology summary", async () => {
    /* @Given two registered clusters */
    await rpc.invoke<ClusterRegisterResponse>("cluster.register", {
      sessionId: STUB_SESSION_ID,
      name: "homelab",
      user: "alice",
      hostname: "workstation",
    });
    await rpc.invoke<ClusterRegisterResponse>("cluster.register", {
      sessionId: STUB_SESSION_ID,
      name: "prod",
      user: "bob",
      hostname: "ops",
    });

    /* @When the list is invoked */
    const response = await rpc.invoke<ClusterListResponse>("cluster.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then both records are returned, none connected, zero nodes/virtualMachines */
    assertEquals(response.length, 2);
    const homelab = response.find((c) => c.name === "homelab")!;
    assertEquals(homelab.provider, "proxmox");
    assertEquals(homelab.connected, false);
    assertEquals(homelab.version, 1);
    assertEquals(homelab.creation.by, "alice");
    assertEquals(homelab.proxmox, { nodeCount: 0, virtualMachineCount: 0 });
    const prod = response.find((c) => c.name === "prod")!;
    assertEquals(prod.creation.by, "bob");
  });
});
